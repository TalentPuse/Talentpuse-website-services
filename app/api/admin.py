from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import config as cfg
from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminJobList,
    AdminStats,
    AdminUserList,
    AlertLogList,
    ConfigUpdate,
    SystemConfig,
    TierUpdate,
)
from app.services.admin import (
    get_admin_stats,
    get_system_config,
    list_alertable_jobs,
    list_alert_logs,
    list_users,
    toggle_user_active,
    update_system_config,
    update_user_tier,
)
from app.services.job_alert import dispatch_alerts

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
