"""Email alert API endpoints — subscribe, unsubscribe, status."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.telegram import AlertSubscription
from app.models.user import User
from app.services.job_alert import EMAIL_ALERT_TYPE

router = APIRouter(prefix="/api/email", tags=["email"])


class EmailAlertStatus(BaseModel):
    enabled: bool
    email: str


@router.get("/alerts/status", response_model=EmailAlertStatus)
async def get_email_alert_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailAlertStatus:
    result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == current_user.id,
            AlertSubscription.alert_type == EMAIL_ALERT_TYPE,
        )
    )
    sub = result.scalar_one_or_none()
    return EmailAlertStatus(
        enabled=sub.enabled if sub else False,
        email=current_user.email,
    )


@router.post("/alerts/subscribe", response_model=EmailAlertStatus)
async def subscribe_email_alert(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailAlertStatus:
    result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == current_user.id,
            AlertSubscription.alert_type == EMAIL_ALERT_TYPE,
        )
    )
    sub = result.scalar_one_or_none()

    if sub is None:
        db.add(AlertSubscription(
            user_id=current_user.id,
            alert_type=EMAIL_ALERT_TYPE,
            enabled=True,
        ))
    else:
        sub.enabled = True

    await db.commit()
    return EmailAlertStatus(enabled=True, email=current_user.email)


@router.post("/alerts/unsubscribe", response_model=EmailAlertStatus)
async def unsubscribe_email_alert(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EmailAlertStatus:
    result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == current_user.id,
            AlertSubscription.alert_type == EMAIL_ALERT_TYPE,
        )
    )
    sub = result.scalar_one_or_none()

    if sub is not None:
        sub.enabled = False
        await db.commit()

    return EmailAlertStatus(enabled=False, email=current_user.email)
