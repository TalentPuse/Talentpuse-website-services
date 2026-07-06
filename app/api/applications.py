from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.application import (
    ApplicationCreate, ApplicationList, ApplicationOut, ApplicationUpdate, StatsOut, TrackedKey,
)
from app.services import application_service as svc

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post("", response_model=ApplicationOut)
async def create(body: ApplicationCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        return await svc.create_application(
            db, user.id, source=body.source or "manual", source_job_id=body.source_job_id,
            title=body.title, company_name=body.company_name, city=body.city,
            source_url=body.source_url, salary_million=body.salary_million,
            status=body.status, applied_at=body.applied_at, notes=body.notes,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Job không tồn tại")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("", response_model=ApplicationList)
async def list_(status: str | None = None, page: int = Query(1, ge=1), per_page: int = Query(50, ge=1, le=100),
                user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    apps = await svc.list_applications(db, user.id, status=status)
    start = (page - 1) * per_page
    return ApplicationList(applications=apps[start:start + per_page], total=len(apps), page=page, per_page=per_page)


@router.get("/stats", response_model=StatsOut)
async def stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.get_stats(db, user.id)


@router.get("/keys", response_model=list[TrackedKey])
async def keys(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await svc.tracked_keys(db, user.id)


@router.patch("/{app_id}", response_model=ApplicationOut)
async def update(app_id: uuid.UUID, body: ApplicationUpdate,
                 user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    app = await svc.update_application(db, user.id, app_id, status=body.status, notes=body.notes, applied_at=body.applied_at)
    if app is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy")
    return app


@router.delete("/{app_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(app_id: uuid.UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not await svc.delete_application(db, user.id, app_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy")
