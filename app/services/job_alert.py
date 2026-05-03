from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.models.telegram import AlertSubscription, TelegramConnection
from app.models.user import User
from app.services.telegram import _send_message

logger = logging.getLogger(__name__)

LEVEL_MAP: dict[str, list[str]] = {
    "student": ["Intern/Student", "Fresher/Entry level"],
    "fresher": ["Fresher/Entry level", "Mid-level"],
    "experienced": ["Mid-level", "Senior"],
    "manager": ["Senior", "Manager", "Director+"],
}


FALLBACK_URL: dict[str, str] = {
    "vietnamworks": "https://www.vietnamworks.com",
    "itviec": "https://itviec.com",
}


def build_job_url(source: str, source_job_id: str, source_url: str | None = None) -> str:
    if source_url:
        return source_url
    return FALLBACK_URL.get(source, "https://www.vietnamworks.com")


ALERT_LIMIT = 3


async def find_matching_jobs(db: AsyncSession, user: User) -> list[dict]:
    titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
    cities = [c.strip() for c in (user.preferred_cities or []) if c.strip()]
    skills = [s.strip().lower() for s in (user.skills or []) if s.strip()]
    min_salary = getattr(user, "desired_salary_min", None)
    experience_level = getattr(user, "experience_level", None)

    allowed_levels = LEVEL_MAP.get(experience_level) if experience_level else None

    # --- build dynamic scoring clauses ---
    params: dict = {"uid": str(user.id)}

    # Title score (40 pts): match on title or job_category
    if titles:
        title_patterns = [f"%{t}%" for t in titles]
        params["title_patterns"] = title_patterns
        title_score = (
            "CASE WHEN f.title ILIKE ANY(:title_patterns) "
            "OR f.job_category ILIKE ANY(:title_patterns) THEN 40 ELSE 0 END"
        )
    else:
        title_score = "0"

    # City score (25 pts)
    if cities:
        params["cities"] = cities
        city_score = "CASE WHEN f.city_canonical = ANY(:cities) THEN 25 ELSE 0 END"
    else:
        city_score = "0"

    # Salary score (20 pts): job has salary >= user min
    if min_salary and min_salary > 0:
        params["min_salary"] = min_salary
        salary_score = (
            "CASE WHEN f.salary_vnd_monthly_avg IS NOT NULL "
            "AND f.salary_vnd_monthly_avg >= :min_salary THEN 20 ELSE 0 END"
        )
    else:
        salary_score = "0"

    # Level filter (hard filter, not score)
    if allowed_levels:
        params["levels"] = allowed_levels
        level_clause = "f.job_level = ANY(:levels)"
    else:
        level_clause = "true"

    # Skill score (15 pts): ratio of overlapping skills
    if skills:
        params["user_skills"] = skills
        skill_score = "COALESCE(sk.skill_ratio * 15, 0)"
        skill_join = """
            LEFT JOIN (
                SELECT s.source, s.source_job_id,
                       count(*) FILTER (WHERE s.skill_name_norm = ANY(:user_skills))::float
                       / GREATEST(count(*), 1) AS skill_ratio
                FROM dbt_dev_silver.silver_skill_long s
                GROUP BY s.source, s.source_job_id
            ) sk ON sk.source = f.source AND sk.source_job_id = f.source_job_id
        """
    else:
        skill_score = "0"
        skill_join = ""

    total_score = f"({title_score} + {city_score} + {salary_score} + {skill_score})"

    sql = text(f"""
        WITH scored AS (
            SELECT DISTINCT ON (f.source, f.source_job_id)
                   f.source, f.source_job_id, f.title, f.company_name,
                   f.city_canonical, f.job_level, f.job_category,
                   round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_m,
                   f.posted_at,
                   sd.source_url,
                   {total_score} AS score
            FROM dbt_dev_gold.fct_jobs_daily f
            LEFT JOIN dbt_dev_silver.silver_job_detail sd
                   ON sd.source = f.source AND sd.source_job_id = f.source_job_id
            {skill_join}
            WHERE f.is_active
              AND f.source_job_id NOT IN (
                  SELECT source_job_id FROM app.alert_logs WHERE user_id = :uid
              )
              AND {level_clause}
        )
        SELECT source, source_job_id, title, company_name, city_canonical,
               job_level, job_category, salary_m, source_url, score
        FROM scored
        WHERE score > 0
        ORDER BY score DESC, posted_at DESC NULLS LAST
        LIMIT {ALERT_LIMIT}
    """)

    result = await db.execute(sql, params)
    return [dict(r._mapping) for r in result.all()]


SOURCE_LABEL: dict[str, str] = {
    "vietnamworks": "VietnamWorks",
    "itviec": "ITviec",
}


def format_job_message(jobs: list[dict]) -> str:
    count = len(jobs)
    lines = [
        f"📋 <b>TalentPulse Alert</b>",
        f"Tìm thấy <b>{count}</b> việc làm mới phù hợp với bạn.\n",
    ]

    for i, j in enumerate(jobs, 1):
        title = j["title"] or "Không rõ"
        company = j["company_name"] or "Không rõ"
        city = j["city_canonical"] or ""
        level = j.get("job_level") or ""
        salary = j["salary_m"]
        source = j.get("source", "vietnamworks")
        source_label = SOURCE_LABEL.get(source, source)
        url = build_job_url(source, j["source_job_id"], j.get("source_url"))

        score = j.get("score")
        score_text = f"  ·  ⭐ {score:.0f}%" if score else ""

        entry = f"<b>{i}. {title}</b>"
        entry += f"\n   🏢 {company}"
        if city:
            entry += f"  ·  📍 {city}"
        if level:
            entry += f"\n   📊 {level}"
        if salary:
            entry += f"  ·  💰 ~{salary:.0f} triệu/tháng"
        entry += score_text
        entry += f'\n   🔗 <a href="{url}">Xem trên {source_label}</a>'
        lines.append(entry)

    lines.append(
        "\n✏️ Cập nhật hồ sơ tại <b>talentpuse.io.vn/profile</b> để nhận alert chính xác hơn."
    )
    return "\n\n".join(lines)


async def dispatch_alerts(db: AsyncSession) -> int:
    result = await db.execute(text("""
        SELECT u.id, u.skills, u.desired_titles, u.desired_salary_min,
               u.preferred_cities, u.experience_level,
               tc.chat_id
        FROM app.users u
        LEFT JOIN app.telegram_connections tc
            ON tc.user_id = u.id AND tc.status = 'active' AND tc.chat_id IS NOT NULL
        WHERE u.is_active = true
          AND array_length(u.skills, 1) > 0
    """))

    rows = result.all()
    total_sent = 0

    for row in rows:
        user_data = row._mapping
        user = _row_to_user(user_data)
        chat_id = user_data["chat_id"]

        try:
            jobs = await find_matching_jobs(db, user)
            if not jobs:
                continue

            for j in jobs:
                db.add(AlertLog(
                    user_id=user.id,
                    source_job_id=j["source_job_id"],
                    channel="website",
                ))

            if chat_id:
                msg = format_job_message(jobs)
                await _send_message(chat_id, msg)
                for j in jobs:
                    db.add(AlertLog(
                        user_id=user.id,
                        source_job_id=j["source_job_id"],
                        channel="telegram",
                    ))

            await db.commit()
            total_sent += len(jobs)
            logger.info("Sent %d alerts to user %s (telegram=%s)", len(jobs), user.id, bool(chat_id))

        except Exception:
            logger.exception("Failed to dispatch alerts for user %s", user_data["id"])
            await db.rollback()

    return total_sent


class _UserProxy:
    """Lightweight proxy to pass query row data to find_matching_jobs."""

    def __init__(self, id, skills, desired_titles, preferred_cities, desired_salary_min, experience_level):
        self.id = id
        self.skills = skills or []
        self.desired_titles = desired_titles or []
        self.preferred_cities = preferred_cities or []
        self.desired_salary_min = desired_salary_min
        self.experience_level = experience_level


def _row_to_user(row) -> _UserProxy:
    return _UserProxy(
        id=row["id"],
        skills=row["skills"],
        desired_titles=row["desired_titles"],
        preferred_cities=row["preferred_cities"],
        desired_salary_min=row["desired_salary_min"],
        experience_level=row["experience_level"],
    )
