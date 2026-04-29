from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.models.telegram import AlertSubscription, TelegramConnection
from app.models.user import User
from app.services.telegram import _send_message

logger = logging.getLogger(__name__)


def build_job_url(source_job_id: str) -> str:
    return f"https://www.vietnamworks.com/--{source_job_id}-jd"


async def find_matching_jobs(db: AsyncSession, user: User) -> list[dict]:
    titles = [t.strip() for t in (user.desired_titles or []) if t.strip()]
    skills = [s.strip().lower() for s in (user.skills or []) if s.strip()]

    if not titles and not skills:
        return []

    conditions = []
    params: dict = {"uid": str(user.id)}

    if titles:
        title_clauses = []
        for i, t in enumerate(titles):
            key = f"t{i}"
            title_clauses.append(f"f.title ILIKE :{key}")
            params[key] = f"%{t}%"
        conditions.append(f"({' OR '.join(title_clauses)})")

    if skills:
        conditions.append("lower(sk.skill_name_norm) = ANY(:user_skills)")
        params["user_skills"] = skills

    where_match = " OR ".join(conditions)

    sql = text(f"""
        SELECT DISTINCT ON (f.source_job_id)
            f.source_job_id,
            f.title,
            f.company_name,
            f.city_canonical,
            f.job_level,
            round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float as salary_m
        FROM dbt_dev_gold.fct_jobs_daily f
        LEFT JOIN dbt_dev_silver.silver_skill_long sk
            ON sk.source = f.source AND sk.source_job_id = f.source_job_id
        WHERE f.is_active
          AND f.source_job_id NOT IN (
              SELECT source_job_id FROM app.alert_logs WHERE user_id = :uid
          )
          AND ({where_match})
        ORDER BY f.source_job_id, f.posted_at DESC NULLS LAST
        LIMIT 10
    """)

    result = await db.execute(sql, params)
    return [dict(r._mapping) for r in result.all()]


def format_job_message(jobs: list[dict]) -> str:
    count = len(jobs)
    lines = [f"🔔 <b>{count} việc làm phù hợp với bạn!</b>\n"]

    for i, j in enumerate(jobs, 1):
        title = j["title"] or "Untitled"
        company = j["company_name"] or "N/A"
        city = j["city_canonical"] or ""
        salary = j["salary_m"]
        url = build_job_url(j["source_job_id"])

        entry = f"{i}. <b>{title}</b>\n   🏢 {company}"
        if city:
            entry += f" • 📍 {city}"
        if salary:
            entry += f"\n   💰 ~{salary:.0f}M VND/tháng"
        entry += f"\n   🔗 <a href=\"{url}\">Xem chi tiết</a>"
        lines.append(entry)

    lines.append("\n💡 Cập nhật profile để nhận alert chính xác hơn!")
    return "\n\n".join(lines)


async def dispatch_alerts(db: AsyncSession) -> int:
    result = await db.execute(text("""
        SELECT u.id, u.skills, u.desired_titles, u.desired_salary_min,
               u.desired_salary_max, u.preferred_cities,
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

    def __init__(self, id, skills, desired_titles):
        self.id = id
        self.skills = skills or []
        self.desired_titles = desired_titles or []


def _row_to_user(row) -> _UserProxy:
    return _UserProxy(
        id=row["id"],
        skills=row["skills"],
        desired_titles=row["desired_titles"],
    )
