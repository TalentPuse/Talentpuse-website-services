from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from app.core.config import VN_TZ

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as cfg
from app.schemas.admin import (
    AdminJobList,
    AdminJobRow,
    AdminStats,
    AdminUserList,
    AdminUserRow,
    AlertLogList,
    AlertLogRow,
    SystemConfig,
)

logger = logging.getLogger(__name__)

VALID_TIERS = {"free", "pro", "enterprise"}


async def get_admin_stats(db: AsyncSession) -> AdminStats:
    now_vn = datetime.now(VN_TZ)
    today_start = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now_vn.weekday())

    result = await db.execute(text("""
        SELECT
            (SELECT count(*) FROM app.users)::int AS total_users,
            (SELECT count(*) FROM app.users WHERE is_active)::int AS active_users,
            (SELECT count(*) FROM app.telegram_connections WHERE status = 'active')::int AS telegram_linked,
            (SELECT count(*) FROM app.alert_logs WHERE sent_at >= :today)::int AS alerts_today,
            (SELECT count(*) FROM app.alert_logs WHERE sent_at >= :week)::int AS alerts_this_week,
            (SELECT count(*) FROM app.alert_logs)::int AS total_alerts
    """), {"today": today_start, "week": week_start})

    row = result.mappings().first()
    return AdminStats(**row)


async def list_users(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    is_active: bool | None = None,
    tier: str | None = None,
) -> AdminUserList:
    conditions = []
    params: dict = {}

    if search:
        conditions.append("(u.email ILIKE :search OR u.full_name ILIKE :search)")
        params["search"] = f"%{search}%"
    if is_active is not None:
        conditions.append("u.is_active = :is_active")
        params["is_active"] = is_active
    if tier:
        conditions.append("u.subscription_tier = :tier")
        params["tier"] = tier

    where = (" AND " + " AND ".join(conditions)) if conditions else ""

    count_result = await db.execute(
        text(f"SELECT count(*) FROM app.users u WHERE 1=1 {where}"),
        params,
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(text(f"""
        SELECT
            u.id, u.email, u.full_name, u.is_active, u.is_admin,
            u.subscription_tier, u.skills, u.desired_titles, u.preferred_cities,
            u.created_at,
            tc.status AS telegram_status,
            tc.telegram_username,
            COALESCE(asub.enabled, false) AS alert_enabled,
            COALESCE(al_count.cnt, 0)::int AS alerts_sent
        FROM app.users u
        LEFT JOIN app.telegram_connections tc ON tc.user_id = u.id
        LEFT JOIN app.alert_subscriptions asub
            ON asub.user_id = u.id AND asub.alert_type = 'job_match'
        LEFT JOIN (
            SELECT user_id, count(*) AS cnt
            FROM app.alert_logs
            GROUP BY user_id
        ) al_count ON al_count.user_id = u.id
        WHERE 1=1 {where}
        ORDER BY u.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)

    users = []
    for row in result.mappings():
        users.append(AdminUserRow(
            id=str(row["id"]),
            email=row["email"],
            full_name=row["full_name"],
            is_active=row["is_active"],
            is_admin=row["is_admin"],
            subscription_tier=row["subscription_tier"],
            skills=row["skills"] or [],
            desired_titles=row["desired_titles"] or [],
            preferred_cities=row["preferred_cities"] or [],
            telegram_status=row["telegram_status"],
            telegram_username=row["telegram_username"],
            alert_enabled=row["alert_enabled"],
            alerts_sent=row["alerts_sent"],
            created_at=row["created_at"],
        ))

    return AdminUserList(users=users, total=total, page=page, per_page=per_page)


async def toggle_user_active(db: AsyncSession, user_id: str, is_active: bool) -> bool:
    result = await db.execute(
        text("UPDATE app.users SET is_active = :active WHERE id = :uid RETURNING id"),
        {"active": is_active, "uid": user_id},
    )
    if result.rowcount == 0:
        return False
    await db.commit()
    return True


async def update_user_tier(db: AsyncSession, user_id: str, tier: str) -> bool:
    if tier not in VALID_TIERS:
        return False
    result = await db.execute(
        text("UPDATE app.users SET subscription_tier = :tier WHERE id = :uid RETURNING id"),
        {"tier": tier, "uid": user_id},
    )
    if result.rowcount == 0:
        return False
    await db.commit()
    return True


async def list_alert_logs(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 50,
    user_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> AlertLogList:
    conditions = []
    params: dict = {}

    if user_id:
        conditions.append("al.user_id = :user_id")
        params["user_id"] = user_id
    if date_from:
        conditions.append("al.sent_at >= :date_from")
        params["date_from"] = datetime.combine(date_from, datetime.min.time())
    if date_to:
        conditions.append("al.sent_at < :date_to")
        params["date_to"] = datetime.combine(date_to + timedelta(days=1), datetime.min.time())

    where = (" AND " + " AND ".join(conditions)) if conditions else ""

    count_result = await db.execute(
        text(f"SELECT count(*) FROM app.alert_logs al WHERE 1=1 {where}"),
        params,
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(text(f"""
        SELECT
            al.id, al.source_job_id, al.channel, al.sent_at,
            u.email AS user_email, u.full_name AS user_full_name,
            f.title AS job_title, f.company_name
        FROM app.alert_logs al
        JOIN app.users u ON u.id = al.user_id
        LEFT JOIN dbt_dev_gold.fct_jobs_daily f
            ON f.source_job_id = al.source_job_id AND f.is_active
        WHERE 1=1 {where}
        ORDER BY al.sent_at DESC
        LIMIT :limit OFFSET :offset
    """), params)

    logs = []
    for row in result.mappings():
        logs.append(AlertLogRow(
            id=str(row["id"]),
            user_email=row["user_email"],
            user_full_name=row["user_full_name"],
            source_job_id=row["source_job_id"],
            job_title=row["job_title"],
            company_name=row["company_name"],
            channel=row["channel"],
            sent_at=row["sent_at"],
        ))

    return AlertLogList(logs=logs, total=total, page=page, per_page=per_page)


async def list_alertable_jobs(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    city: str | None = None,
    level: str | None = None,
    has_salary: bool | None = None,
) -> AdminJobList:
    conditions = []
    params: dict = {}

    if search:
        conditions.append("(f.title ILIKE :search OR f.company_name ILIKE :search)")
        params["search"] = f"%{search}%"
    if city:
        conditions.append("f.city_canonical = :city")
        params["city"] = city
    if level:
        conditions.append("f.job_level = :level")
        params["level"] = level
    if has_salary is True:
        conditions.append("f.salary_vnd_monthly_avg IS NOT NULL")
    elif has_salary is False:
        conditions.append("f.salary_vnd_monthly_avg IS NULL")

    where_extra = (" AND " + " AND ".join(conditions)) if conditions else ""

    count_result = await db.execute(
        text(f"""
            SELECT count(DISTINCT f.source_job_id)
            FROM dbt_dev_gold.fct_jobs_daily f
            WHERE f.is_active {where_extra}
        """),
        params,
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    result = await db.execute(text(f"""
        SELECT
            f.source,
            f.source_job_id,
            f.title,
            f.company_name,
            f.city_canonical,
            f.job_level,
            round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
            f.is_active,
            f.posted_at,
            f.expired_at,
            f.num_of_views,
            f.num_of_applications,
            COALESCE(
                array_agg(DISTINCT sk.skill_name_norm) FILTER (WHERE sk.skill_name_norm IS NOT NULL),
                ARRAY[]::text[]
            ) AS skills
        FROM dbt_dev_gold.fct_jobs_daily f
        LEFT JOIN dbt_dev_silver.silver_skill_long sk
            ON sk.source = f.source AND sk.source_job_id = f.source_job_id
        WHERE f.is_active {where_extra}
        GROUP BY f.source, f.source_job_id, f.title, f.company_name,
                 f.city_canonical, f.job_level, f.salary_vnd_monthly_avg,
                 f.is_active, f.posted_at, f.expired_at,
                 f.num_of_views, f.num_of_applications
        ORDER BY f.posted_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), params)

    jobs = []
    for row in result.mappings():
        jobs.append(AdminJobRow(
            source=row["source"],
            source_job_id=row["source_job_id"],
            title=row["title"],
            company_name=row["company_name"],
            city_canonical=row["city_canonical"],
            job_level=row["job_level"],
            salary_million=row["salary_million"],
            is_active=row["is_active"],
            posted_at=row["posted_at"],
            expired_at=row["expired_at"],
            num_of_views=row["num_of_views"],
            num_of_applications=row["num_of_applications"],
            skills=row["skills"] or [],
        ))

    return AdminJobList(jobs=jobs, total=total, page=page, per_page=per_page)


def get_system_config() -> SystemConfig:
    from app import main as main_mod

    return SystemConfig(
        alert_interval_seconds=cfg.ALERT_INTERVAL_SECONDS,
        alert_loop_active=getattr(main_mod, "alert_loop_active", True),
        cors_origins=cfg.CORS_ORIGINS,
        telegram_bot_username=cfg.TELEGRAM_BOT_USERNAME,
        telegram_bot_configured=bool(cfg.TELEGRAM_BOT_TOKEN),
    )


def update_system_config(
    *,
    alert_interval_seconds: int | None = None,
    alert_loop_active: bool | None = None,
) -> SystemConfig:
    from app import main as main_mod

    if alert_interval_seconds is not None:
        cfg.ALERT_INTERVAL_SECONDS = alert_interval_seconds
    if alert_loop_active is not None:
        main_mod.alert_loop_active = alert_loop_active
    return get_system_config()
