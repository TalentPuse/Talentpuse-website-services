"""Email alert API endpoints — subscribe, unsubscribe, status."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.unsubscribe import doc_token
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


# ─── One-click unsubscribe (RFC 8058) ──────────────────────────────


async def _tat_email_alert(db: AsyncSession, user_id: str) -> None:
    """Tat `email_job_match` cho user, khong doi hoi phien dang nhap."""
    result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == user_id,
            AlertSubscription.alert_type == EMAIL_ALERT_TYPE,
        )
    )
    sub = result.scalar_one_or_none()
    if sub is not None and sub.enabled:
        sub.enabled = False
        await db.commit()


@router.post("/alerts/unsubscribe/one-click")
async def one_click_unsubscribe(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Endpoint ma Gmail/Yahoo goi khi nguoi dung bam "Unsubscribe".

    RFC 8058 yeu cau POST, va yeu cau KHONG duoc doi hoi bat ky buoc xac nhan
    nao — mail client goi thang, khong co nguoi ngoi truoc man hinh.

    Luon tra 200 ke ca khi token sai: mail client hien "khong huy duoc" chi lam
    nguoi dung bam Report spam. Token sai thi khong tat gi ca, chi im lang.
    """
    user_id = doc_token(token)
    if user_id:
        await _tat_email_alert(db, user_id)
    return {"ok": True}


@router.get("/alerts/unsubscribe/one-click")
async def one_click_unsubscribe_link(
    token: str,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Link cho NGUOI bam trong noi dung email (khong phai mail client).

    Cung mot token, nhung tra ve HTML de nguoi dung biet da xong. Khong redirect
    ve trang dang nhap: nguoi vua huy nhan mail la nguoi it muon dang nhap nhat.
    """
    user_id = doc_token(token)
    if user_id:
        await _tat_email_alert(db, user_id)
        loi_nhan = "Đã hủy nhận email thông báo việc làm."
    else:
        loi_nhan = "Liên kết hủy không hợp lệ. Bạn có thể tắt trong trang cá nhân."

    return Response(
        content=(
            "<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\">"
            "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
            "<title>TalentPuse</title></head>"
            "<body style=\"font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem\">"
            f"<h1 style=\"font-size:1.25rem\">{loi_nhan}</h1>"
            "<p style=\"color:#64748b\">Bạn vẫn nhận thông báo qua Telegram nếu đã kết nối. "
            "Quản lý tại <a href=\"https://talentpuse.io.vn/profile\">talentpuse.io.vn/profile</a>.</p>"
            "</body></html>"
        ),
        media_type="text/html; charset=utf-8",
    )
