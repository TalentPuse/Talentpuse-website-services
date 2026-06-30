from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as cfg
from app.core.database import get_db
from app.core.security import require_admin
from app.models.alert_log import AlertLog
from app.models.user import User
from app.schemas.admin import (
    AdminJobList,
    AdminStats,
    AdminUserProfile,
    AdminUserList,
    AlertLogList,
    ConfigUpdate,
    EmailAlertUpdate,
    SystemConfig,
    TierUpdate,
)
from app.services.admin import (
    get_admin_stats,
    get_system_config,
    get_user_profile,
    list_alertable_jobs,
    list_alert_logs,
    list_users,
    set_user_email_alert,
    toggle_user_active,
    update_system_config,
    update_user_tier,
)
from app.services.email import send_job_alert_email
from app.services.job_alert import dispatch_alerts, email_all_users
from app.services.job_matcher import MatchedJob

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
async def stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminStats:
    return await get_admin_stats(db)


@router.get("/users", response_model=AdminUserList)
async def users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
    tier: str | None = Query(None),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserList:
    return await list_users(db, page=page, per_page=per_page, search=search, is_active=is_active, tier=tier)


@router.get("/users/{user_id}", response_model=AdminUserProfile)
async def user_profile(
    user_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserProfile:
    profile = await get_user_profile(db, user_id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User không tồn tại")
    return profile


@router.put("/users/{user_id}/toggle-active")
async def toggle_active(
    user_id: str,
    is_active: bool = Query(...),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ok = await toggle_user_active(db, user_id, is_active)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User không tồn tại")
    return {"ok": True, "is_active": is_active}


@router.put("/users/{user_id}/tier")
async def change_tier(
    user_id: str,
    data: TierUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ok = await update_user_tier(db, user_id, data.tier)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tier không hợp lệ hoặc user không tồn tại",
        )
    return {"ok": True, "tier": data.tier}


@router.get("/jobs", response_model=AdminJobList)
async def jobs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    city: str | None = Query(None),
    level: str | None = Query(None),
    has_salary: bool | None = Query(None),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminJobList:
    return await list_alertable_jobs(
        db, page=page, per_page=per_page, search=search,
        city=city, level=level, has_salary=has_salary,
    )


@router.get("/alert-logs", response_model=AlertLogList)
async def alert_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    channel: str | None = Query(None),
    search: str | None = Query(None),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AlertLogList:
    return await list_alert_logs(
        db,
        page=page,
        per_page=per_page,
        user_id=user_id,
        date_from=date_from,
        date_to=date_to,
        channel=channel,
        search=search,
    )


@router.get("/config", response_model=SystemConfig)
async def config_get(
    _admin: User = Depends(require_admin),
) -> SystemConfig:
    return get_system_config()


@router.put("/config", response_model=SystemConfig)
async def config_update(
    data: ConfigUpdate,
    _admin: User = Depends(require_admin),
) -> SystemConfig:
    return update_system_config(
        alert_interval_seconds=data.alert_interval_seconds,
        alert_loop_active=data.alert_loop_active,
    )


@router.post("/alerts/dispatch")
async def manual_dispatch(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    count = await dispatch_alerts(db, source="admin_manual")
    return {"dispatched": count}


@router.post("/alerts/dispatch-internal")
async def internal_dispatch(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    secret = request.headers.get("X-Webhook-Secret", "")
    if not secret or secret != cfg.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")
    source = request.headers.get("X-Dispatch-Source", "cron_webhook")
    count = await dispatch_alerts(db, source=source)
    return {"dispatched": count}


@router.put("/users/{user_id}/email-alert")
async def toggle_email_alert(
    user_id: str,
    data: EmailAlertUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ok = await set_user_email_alert(db, user_id, data.enabled)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User không tồn tại")
    return {"ok": True, "email_alert_enabled": data.enabled}


@router.post("/alerts/email-all")
async def email_all(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Force-send an email job alert to EVERY active user-role (non-admin) user."""
    result = await email_all_users(db, source="admin_manual")
    return result


@router.post("/alerts/retry")
async def retry_failed_alerts(
    request: Request,
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    user_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Retry failed email alerts within date range and user filter."""
    # Build query for failed email alerts
    where_clause = [
        AlertLog.channel == "email",
        AlertLog.status == "failed",
    ]
    if date_from:
        where_clause.append(AlertLog.sent_at >= datetime.fromisoformat(date_from))
    if date_to:
        where_clause.append(AlertLog.sent_at <= datetime.fromisoformat(date_to))
    if user_id:
        where_clause.append(AlertLog.user_id == uuid.UUID(user_id))

    result = await db.execute(
        select(AlertLog).where(and_(*where_clause)).order_by(AlertLog.sent_at).limit(limit)
    )
    failed_logs = result.scalars().all()

    if not failed_logs:
        return {"retried": 0, "total": 0, "message": "Không có failed alerts nào để retry"}

    retried = 0
    for log in failed_logs:
        # Get user email
        user_result = await db.execute(select(User).where(User.id == log.user_id))
        user = user_result.scalar_one_or_none()
        if not user or not user.email:
            continue

        # Re-fetch job details
        job = await _get_matched_job_details(db, log.source_job_id)
        if not job:
            continue

        # Retry sending
        email_result = await send_job_alert_email(
            to=user.email,
            user_name=user.full_name,
            jobs=[job],
        )
        if email_result.success:
            log.status = "sent"
            log.retry_count += 1
            log.last_retry_at = datetime.utcnow()
            log.error_message = None
            retried += 1
        else:
            log.status = "failed"
            log.error_message = (email_result.error or "Unknown error")[:500]
            log.retry_count += 1

    await db.commit()
    return {"retried": retried, "total": len(failed_logs)}


@router.get("/alerts/dispatch-stats")
async def get_dispatch_stats(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get dispatch statistics for monitoring."""
    where_clause = ["1=1"]
    params: dict = {}
    if date_from:
        where_clause.append("sent_at >= :date_from")
        params["date_from"] = datetime.fromisoformat(date_from)
    if date_to:
        where_clause.append("sent_at <= :date_to")
        params["date_to"] = datetime.fromisoformat(date_to)
    where_sql = " AND ".join(where_clause)

    # Total dispatched by channel
    channel_result = await db.execute(text(f"""
        SELECT channel, COUNT(*) as count
        FROM app.alert_logs
        WHERE {where_sql}
        GROUP BY channel
    """), params)
    channel_stats = {r["channel"]: r["count"] for r in channel_result.mappings()}

    # Failed email alerts
    failed_result = await db.execute(text(f"""
        SELECT COUNT(*) as count
        FROM app.alert_logs
        WHERE channel='email' AND status='failed' AND {where_sql}
    """), params)
    failed_count = failed_result.scalar()

    # Dispatch by source
    source_result = await db.execute(text(f"""
        SELECT source, COUNT(DISTINCT source_job_id) as count
        FROM app.alert_logs
        WHERE {where_sql}
        GROUP BY source
    """), params)
    source_stats = {r["source"]: r["count"] for r in source_result.mappings()}

    return {
        "channel_breakdown": channel_stats,
        "failed_emails": failed_count,
        "source_breakdown": source_stats,
    }


@router.get("/alerts/dispatch-history")
async def get_dispatch_history(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get dispatch history aggregated by sent_at and source."""
    offset = (page - 1) * per_page

    where_clause = ["1=1"]
    params: dict = {"limit": per_page, "offset": offset}
    if date_from:
        where_clause.append("DATE(sent_at) >= :date_from")
        params["date_from"] = datetime.fromisoformat(date_from).date()
    if date_to:
        where_clause.append("DATE(sent_at) <= :date_to")
        params["date_to"] = datetime.fromisoformat(date_to).date()
    where_sql = " AND ".join(where_clause)

    # Total distinct (date, source) groups for pagination.
    # NOTE: COUNT(DISTINCT a, b) is invalid in Postgres (single-arg only) — use a subquery.
    count_result = await db.execute(text(f"""
        SELECT COUNT(*) as total FROM (
            SELECT DISTINCT DATE(sent_at), source
            FROM app.alert_logs
            WHERE {where_sql}
        ) g
    """), params)
    total = count_result.scalar() or 0

    # Get paginated history
    history_result = await db.execute(text(f"""
        SELECT
            DATE(sent_at) as dispatch_date,
            source,
            COUNT(DISTINCT source_job_id) as jobs_sent,
            COUNT(*) as total_logs,
            COUNT(DISTINCT CASE WHEN channel='telegram' THEN source_job_id END) as telegram_sent,
            COUNT(DISTINCT CASE WHEN channel='email' THEN source_job_id END) as email_sent
        FROM app.alert_logs
        WHERE {where_sql}
        GROUP BY DATE(sent_at), source
        ORDER BY dispatch_date DESC, source DESC
        LIMIT :limit OFFSET :offset
    """), params)

    entries = []
    for row in history_result.mappings():
        entries.append({
            "date": row["dispatch_date"].isoformat() if row["dispatch_date"] else None,
            "source": row["source"] or "unknown",
            "jobs_sent": row["jobs_sent"],
            "total_logs": row["total_logs"],
            "telegram_sent": row["telegram_sent"],
            "email_sent": row["email_sent"],
        })

    return {
        "entries": entries,
        "total": total,
        "page": page,
        "per_page": per_page,
    }


async def _get_matched_job_details(db: AsyncSession, source_job_id: str) -> MatchedJob | None:
    """Re-fetch job details for retry by source_job_id."""
    result = await db.execute(text("""
        SELECT
            f.source, f.source_job_id, f.title, f.company_name,
            f.city_canonical, f.job_level, f.job_category,
            round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_m,
            f.posted_at,
            sd.source_url, sd.primary_address, sd.city_raw_vi
        FROM dbt_dev_gold.fct_jobs_daily f
        LEFT JOIN dbt_dev_silver.silver_job_detail sd
            ON sd.source = f.source AND sd.source_job_id = f.source_job_id
        WHERE f.source_job_id = :source_job_id
        LIMIT 1
    """), {"source_job_id": source_job_id})

    row = result.mappings().first()
    if not row:
        return None

    return MatchedJob(
        source=row["source"],
        source_job_id=row["source_job_id"],
        title=row["title"],
        company_name=row["company_name"],
        city_canonical=row["city_canonical"],
        job_level=row["job_level"],
        job_category=row["job_category"],
        salary_m=row["salary_m"],
        source_url=row.get("source_url"),
        posted_at=row.get("posted_at"),
        address=row.get("primary_address"),
        city_raw_vi=row.get("city_raw_vi"),
    )
