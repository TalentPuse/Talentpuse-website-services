"""Job matching logic for alert dispatch.

JobMatcher finds jobs matching a user's profile and manages dedup via alert_logs.
All queries use SQLAlchemy Core for type safety — no raw SQL strings.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    any_,
    case,
    func,
    literal_column,
    select,
    and_,
    not_,
    exists,
    cast,
    Float,
    Numeric,
    String,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.models.analytics import fct_jobs_daily, silver_job_detail, silver_skill_enriched
from app.models.user import User

logger = logging.getLogger(__name__)

# ─── Canonical level taxonomy ──────────────────────────────────────

LEVEL_MAP: dict[str, list[str]] = {
    "student": ["Intern/Student", "Fresher/Entry level"],
    "fresher": ["Fresher/Entry level", "Mid-level"],
    "experienced": ["Mid-level", "Senior"],
    "manager": ["Senior", "Manager", "Director+"],
}

ALERT_LIMIT = 3
STUDENT_ALERT_LIMIT = 50


# ─── Result type ───────────────────────────────────────────────────

@dataclass
class MatchedJob:
    source: str
    source_job_id: str
    title: str | None = None
    company_name: str | None = None
    city_canonical: str | None = None
    job_level: str | None = None
    job_category: str | None = None
    salary_m: float | None = None
    source_url: str | None = None
    posted_at: datetime | None = None
    score: float | None = None
    address: str | None = None
    city_raw_vi: str | None = None


def _row_to_job(row, score: float | None = None) -> MatchedJob:
    mapping = row._mapping
    return MatchedJob(
        source=mapping["source"],
        source_job_id=mapping["source_job_id"],
        title=mapping["title"],
        company_name=mapping["company_name"],
        city_canonical=mapping["city_canonical"],
        job_level=mapping["job_level"],
        job_category=mapping["job_category"],
        salary_m=mapping["salary_m"],
        source_url=mapping.get("source_url"),
        posted_at=mapping.get("posted_at"),
        score=score,
        address=mapping.get("primary_address"),
        city_raw_vi=mapping.get("city_raw_vi"),
    )


# ─── Shared column expressions ─────────────────────────────────────

_salary_m = func.round(
    cast(fct_jobs_daily.c.salary_vnd_monthly_avg / 1000000.0, Numeric(10, 1))
).label("salary_m")


def _base_columns():
    return [
        fct_jobs_daily.c.source,
        fct_jobs_daily.c.source_job_id,
        fct_jobs_daily.c.title,
        fct_jobs_daily.c.company_name,
        fct_jobs_daily.c.city_canonical,
        fct_jobs_daily.c.job_level,
        fct_jobs_daily.c.job_category,
        _salary_m,
        fct_jobs_daily.c.posted_at,
        silver_job_detail.c.source_url,
        silver_job_detail.c.primary_address,
        silver_job_detail.c.city_raw_vi,
    ]


def _alerted_subquery(user_id: UUID):
    return select(AlertLog.source_job_id).where(AlertLog.user_id == user_id)


def _jobs_join():
    return fct_jobs_daily.outerjoin(
        silver_job_detail,
        and_(
            silver_job_detail.c.source == fct_jobs_daily.c.source,
            silver_job_detail.c.source_job_id == fct_jobs_daily.c.source_job_id,
        ),
    )


# ─── JobMatcher ────────────────────────────────────────────────────

class JobMatcher:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_already_alerted_ids(self, user_id: UUID) -> set[str]:
        result = await self.db.execute(
            select(AlertLog.source_job_id).where(AlertLog.user_id == user_id)
        )
        return {r[0] for r in result.all()}

    async def find_jobs(self, user: User) -> list[MatchedJob]:
        if getattr(user, "experience_level", None) == "student":
            return await self._find_student_jobs(user)
        return await self._find_scored_jobs(user)

    # ── Student: hard title filter, Intern/Fresher only ────────────

    async def _find_student_jobs(self, user: User) -> list[MatchedJob]:
        titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
        if not titles:
            return []

        title_patterns = [f"%{t}%" for t in titles]
        levels = LEVEL_MAP["student"]

        alerted = _alerted_subquery(user.id)
        query = (
            select(*_base_columns())
            .select_from(_jobs_join())
            .where(
                and_(
                    fct_jobs_daily.c.is_active == True,  # noqa: E712
                    not_(fct_jobs_daily.c.source_job_id.in_(alerted)),
                    fct_jobs_daily.c.job_level == any_(levels),
                    (fct_jobs_daily.c.title.ilike(any_(title_patterns)))
                    | (fct_jobs_daily.c.job_category.ilike(any_(title_patterns))),
                )
            )
            .order_by(fct_jobs_daily.c.posted_at.desc().nullslast())
            .limit(STUDENT_ALERT_LIMIT)
        )

        result = await self.db.execute(query)
        return [_row_to_job(r) for r in result.all()]

    # ── Non-student: scoring with title/city/salary/skills ──────────

    async def _find_scored_jobs(self, user: User) -> list[MatchedJob]:
        titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
        cities = [c.strip() for c in (user.preferred_cities or []) if c.strip()]
        skills = [s.strip().lower() for s in (user.skills or []) if s.strip()]
        min_salary = getattr(user, "desired_salary_min", None)
        experience_level = getattr(user, "experience_level", None)

        allowed_levels = LEVEL_MAP.get(experience_level) if experience_level else None

        # Build score components
        title_score = self._title_score_expr(titles)
        city_score = self._city_score_expr(cities)
        salary_score = self._salary_score_expr(min_salary)
        skill_score, skill_subq = self._skill_score_expr(skills)

        total_score = (title_score + city_score + salary_score + skill_score).label("score")

        alerted = _alerted_subquery(user.id)

        # Build FROM with optional skill join
        from_clause = _jobs_join()
        if skill_subq is not None:
            from_clause = from_clause.join(
                skill_subq,
                and_(
                    skill_subq.c.source == fct_jobs_daily.c.source,
                    skill_subq.c.source_job_id == fct_jobs_daily.c.source_job_id,
                ),
                full=False,
                isouter=True,
            )

        # Level filter
        level_filters = []
        if allowed_levels:
            level_filters.append(fct_jobs_daily.c.job_level == any_(allowed_levels))

        # Scored CTE
        scored_cols = [
            * _base_columns(),
            total_score,
        ]
        scored_query = (
            select(*scored_cols)
            .select_from(from_clause)
            .where(
                and_(
                    fct_jobs_daily.c.is_active == True,  # noqa: E712
                    not_(fct_jobs_daily.c.source_job_id.in_(alerted)),
                    *level_filters,
                )
            )
            .distinct(fct_jobs_daily.c.source, fct_jobs_daily.c.source_job_id)
        )

        scored = scored_query.cte("scored")

        final = (
            select(
                scored.c.source,
                scored.c.source_job_id,
                scored.c.title,
                scored.c.company_name,
                scored.c.city_canonical,
                scored.c.job_level,
                scored.c.job_category,
                scored.c.salary_m,
                scored.c.source_url,
                scored.c.posted_at,
                scored.c.score,
                scored.c.primary_address,
                scored.c.city_raw_vi,
            )
            .where(scored.c.score > 0)
            .order_by(scored.c.score.desc(), scored.c.posted_at.desc().nullslast())
            .limit(ALERT_LIMIT)
        )

        result = await self.db.execute(final)
        return [_row_to_job(r, score=r._mapping.get("score")) for r in result.all()]

    # ── Score expressions ───────────────────────────────────────────

    @staticmethod
    def _title_score_expr(titles: list[str]) -> case:
        if not titles:
            return literal_column("0")
        patterns = [f"%{t}%" for t in titles]
        return case(
            (
                (fct_jobs_daily.c.title.ilike(any_(patterns)))
                | (fct_jobs_daily.c.job_category.ilike(any_(patterns))),
                40,
            ),
            else_=0,
        )

    @staticmethod
    def _city_score_expr(cities: list[str]) -> case:
        if not cities:
            return literal_column("0")
        return case(
            (fct_jobs_daily.c.city_canonical == any_(cities), 25),
            else_=0,
        )

    @staticmethod
    def _salary_score_expr(min_salary: int | None) -> case:
        if not min_salary or min_salary <= 0:
            return literal_column("0")
        return case(
            (
                and_(
                    fct_jobs_daily.c.salary_vnd_monthly_avg.isnot(None),
                    fct_jobs_daily.c.salary_vnd_monthly_avg >= min_salary,
                ),
                20,
            ),
            else_=0,
        )

    @staticmethod
    def _skill_score_expr(skills: list[str]):
        if not skills:
            return literal_column("0"), None

        skill_subq = (
            select(
                silver_skill_enriched.c.source,
                silver_skill_enriched.c.source_job_id,
                (
                    func.count()
                    .filter(silver_skill_enriched.c.skill_name == any_(skills))
                    .cast(Float)
                    / func.greatest(func.count(), 1)
                ).label("skill_ratio"),
            )
            .group_by(silver_skill_enriched.c.source, silver_skill_enriched.c.source_job_id)
            .subquery("sk")
        )

        return func.coalesce(skill_subq.c.skill_ratio * 15, 0), skill_subq

    # ── Dedup + log + send ──────────────────────────────────────────

    async def log_and_send(
        self,
        user: User,
        jobs: list[MatchedJob],
        chat_id: int | None,
        send_fn,
    ) -> int:
        """Log new alerts to DB and send via telegram. Returns count of new jobs."""
        alerted = await self.get_already_alerted_ids(user.id)
        new_jobs = [j for j in jobs if j.source_job_id not in alerted]

        if not new_jobs:
            return 0

        # Log website channel BEFORE sending telegram
        for j in new_jobs:
            self.db.add(AlertLog(
                user_id=user.id,
                source_job_id=j.source_job_id,
                channel="website",
            ))
        await self.db.flush()

        if chat_id:
            try:
                msg = _format_job_message(new_jobs)
                await send_fn(chat_id, msg)
                for j in new_jobs:
                    self.db.add(AlertLog(
                        user_id=user.id,
                        source_job_id=j.source_job_id,
                        channel="telegram",
                    ))
            except Exception:
                logger.exception("Telegram send failed for user %s", user.id)

        return len(new_jobs)


# ─── Message formatting ────────────────────────────────────────────

SOURCE_LABEL: dict[str, str] = {
    "vietnamworks": "VietnamWorks",
    "itviec": "ITviec",
}

FALLBACK_URL: dict[str, str] = {
    "vietnamworks": "https://www.vietnamworks.com",
    "itviec": "https://itviec.com",
}


def _build_job_url(job: MatchedJob) -> str:
    if job.source_url:
        return job.source_url
    return FALLBACK_URL.get(job.source, "https://www.vietnamworks.com")


def _format_job_message(jobs: list[MatchedJob]) -> str:
    count = len(jobs)
    lines = [
        f"\U0001f4cb <b>TalentPuse Alert</b>",
        f"Tìm thấy <b>{count}</b> việc làm mới phù hợp với bạn.\n",
    ]

    for i, j in enumerate(jobs, 1):
        title = j.title or "Không rõ"
        company = j.company_name or "Không rõ"
        city = j.city_raw_vi or j.city_canonical or ""
        level = j.job_level or ""
        salary = j.salary_m
        source_label = SOURCE_LABEL.get(j.source, j.source)
        url = _build_job_url(j)

        score_text = f"  ·  ⭐ {j.score:.0f}%" if j.score else ""

        entry = f"<b>{i}. {title}</b>"
        entry += f"\n   \U0001f3e2 {company}"
        if city:
            entry += f"  ·  \U0001f4cd {city}"
        if j.address:
            entry += f"\n   \U0001f4cd {j.address}"
        if level:
            entry += f"\n   \U0001f4ca {level}"
        if salary:
            entry += f"  ·  \U0001f4b0 ~{salary:.0f} triệu/tháng"
        entry += score_text
        entry += f'\n   \U0001f517 <a href="{url}">Xem trên {source_label}</a>'
        lines.append(entry)

    lines.append(
        "\n✏️ Cập nhật hồ sơ tại <b>talentpuse.io.vn/profile</b> để nhận alert chính xác hơn."
    )
    return "\n\n".join(lines)
