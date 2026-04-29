from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import TELEGRAM_WEBHOOK_SECRET
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.telegram import DeepLinkResponse, TelegramStatusResponse, TelegramUpdate
from app.services.job_alert import dispatch_alerts
from app.services.telegram import (
    generate_deep_link,
    get_status,
    handle_webhook_update,
    unlink,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram", tags=["telegram"])


@router.post("/link", response_model=DeepLinkResponse)
async def create_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeepLinkResponse:
    return await generate_deep_link(db, current_user.id)


@router.get("/status", response_model=TelegramStatusResponse)
async def telegram_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TelegramStatusResponse:
    return await get_status(db, current_user.id)


@router.delete("/link")
async def delete_link(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await unlink(db, current_user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/webhook")
async def webhook(
    update: TelegramUpdate,
    x_telegram_bot_api_secret_token: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
        )
    try:
        await handle_webhook_update(db, update)
    except Exception:
        logger.exception("Webhook handler error")
    return {"ok": True}


@router.post("/alerts/dispatch")
async def dispatch_job_alerts(
    x_cron_secret: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if x_cron_secret != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
        )
    count = await dispatch_alerts(db)
    return {"dispatched": count}
