from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as cfg
from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminJobList,
    AdminStats,
    AdminUserProfile,
    AdminUserList,
    AlertLogList,
    ConfigUpdate,
    EmailAlertUpdate,
    EmailTestRequest,
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
from app.services.job_alert import dispatch_alerts
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
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AlertLogList:
    return await list_alert_logs(db, page=page, per_page=per_page, user_id=user_id, date_from=date_from, date_to=date_to)


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
    count = await dispatch_alerts(db)
    return {"dispatched": count}


@router.post("/alerts/dispatch-internal")
async def internal_dispatch(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    secret = request.headers.get("X-Webhook-Secret", "")
    if not secret or secret != cfg.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")
    count = await dispatch_alerts(db)
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


@router.post("/alerts/email-test")
async def email_test(
    data: EmailTestRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Send a sample job-alert email to an arbitrary address (admin smoke test)."""
    jobs = await _sample_jobs(db)
    if not jobs:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Không có job active nào để gửi mẫu",
        )

    result = await send_job_alert_email(to=str(data.to), user_name="Test", jobs=jobs)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gửi email thất bại: {result.error or 'unknown error'}",
        )
    return {"ok": True, "message_id": result.message_id, "to": str(data.to)}


async def _sample_jobs(db: AsyncSession, limit: int = 3) -> list[MatchedJob]:
    """Grab a few recent active jobs to populate a sample alert email."""
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
        WHERE f.is_active
        ORDER BY f.posted_at DESC NULLS LAST
        LIMIT :limit
    """), {"limit": limit})
    jobs: list[MatchedJob] = []
    for row in result.mappings():
        jobs.append(MatchedJob(
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
        ))
    return jobs
