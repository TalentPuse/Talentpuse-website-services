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
    "fresher": ["Fresher/Entry level", "Experienced (non-manager)"],
    "experienced": ["Fresher/Entry level", "Experienced (non-manager)", "Manager"],
    "manager": ["Experienced (non-manager)", "Manager"],
}


def build_job_url(source: str, source_job_id: str) -> str:
    if source == "itviec":
        return f"https://itviec.com/it-jobs/{source_job_id}"
    return f"https://www.vietnamworks.com/--{source_job_id}-jd"


async def find_matching_jobs(db: AsyncSession, user: User) -> list[dict]:
    titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
    cities = [c.strip() for c in (user.preferred_cities or []) if c.strip()]
    min_salary = getattr(user, "desired_salary_min", None)
    experience_level = getattr(user, "experience_level", None)

    # Step 1 — level filter
    allowed_levels = LEVEL_MAP.get(experience_level) if experience_level else None
    if allowed_levels:
        level_clause = "(f.job_level = ANY(:levels) OR f.job_level IS NULL)"
    else:
        level_clause = "true"

    # Step 2 — content filter (titles → match job title + job_category)
    params: dict = {"uid": str(user.id)}
    title_patterns = [f"%{t}%" for t in titles]

    if title_patterns:
        content_clause = "(f.title ILIKE ANY(:title_patterns) OR f.job_category ILIKE ANY(:title_patterns))"
        params["title_patterns"] = title_patterns
    else:
        content_clause = "true"

    if allowed_levels:
        params["levels"] = allowed_levels

    # Step 3 — soft sort
    has_cities = bool(cities)
    has_salary = min_salary is not None and min_salary > 0

    if has_cities:
        params["cities"] = cities
    if has_salary:
        params["min_salary"] = min_salary

    city_sort = (
        "CASE WHEN m.city_canonical = ANY(:cities) THEN 0 ELSE 1 END"
        if has_cities
        else "0::int"
    )
    salary_sort = (
        "CASE WHEN m.salary_vnd_monthly_avg IS NOT NULL AND m.salary_vnd_monthly_avg >= :min_salary THEN 0 ELSE 1 END"
        if has_salary
        else "0::int"
    )

    sql = text(f"""
        WITH matched AS (
            SELECT DISTINCT f.source, f.source_job_id, f.title, f.company_name,
                   f.city_canonical, f.job_level, f.job_category,
                   round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_m,
                   f.posted_at, f.salary_vnd_monthly_avg
            FROM dbt_dev_gold.fct_jobs_daily f
            WHERE f.is_active
              AND f.source_job_id NOT IN (
                  SELECT source_job_id FROM app.alert_logs WHERE user_id = :uid
              )
              AND {level_clause}
              AND {content_clause}
        )
        SELECT source, source_job_id, title, company_name, city_canonical,
               job_level, job_category, salary_m
        FROM matched m
        ORDER BY
            {city_sort},
            {salary_sort},
            m.posted_at DESC NULLS LAST
        LIMIT 20
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
        url = build_job_url(source, j["source_job_id"])

        entry = f"<b>{i}. {title}</b>"
        entry += f"\n   🏢 {company}"
        if city:
            entry += f"  ·  📍 {city}"
        if level:
            entry += f"\n   📊 {level}"
        if salary:
            entry += f"  ·  💰 ~{salary:.0f} triệu/tháng"
        elif salary is None and level:
            pass
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
        JOIN app.telegram_connections tc ON tc.user_id = u.id
        JOIN app.alert_subscriptions asub ON asub.user_id = u.id
        WHERE tc.status = 'active'
          AND tc.chat_id IS NOT NULL
          AND asub.alert_type = 'job_match'
          AND asub.enabled = true
          AND u.is_active = true
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
            logger.info("Sent %d alerts to user %s", len(jobs), user.id)

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
