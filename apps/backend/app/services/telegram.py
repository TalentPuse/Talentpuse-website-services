from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta

from app.core.config import VN_TZ

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME
from app.models.telegram import AlertSubscription, TelegramConnection
from app.schemas.telegram import (
    DeepLinkResponse,
    TelegramMessage,
    TelegramStatusResponse,
    TelegramUpdate,
)

logger = logging.getLogger(__name__)

LINK_CODE_TTL = timedelta(minutes=15)

_http: httpx.AsyncClient | None = None


async def _get_http() -> httpx.AsyncClient:
    global _http
    if _http is None or _http.is_closed:
        _http = httpx.AsyncClient(timeout=10.0)
    return _http


class TelegramSendError(RuntimeError):
    """Telegram tu choi tin nhan (JA-03).

    Mang theo `description` cua Telegram va `retry_after` (giay) cua loi 429 de
    ben goi con ghi duoc nguyen nhan that vao `alert_logs.error_message` thay vi
    mot dong "Unknown error".
    """

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        description: str | None = None,
        retry_after: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.description = description
        self.retry_after = retry_after


async def _send_message(chat_id: int, text: str) -> None:
    """Gui tin toi Telegram. RAISE `TelegramSendError` khi that bai.

    Ban cu goi `client.post(...)` roi vut bo response va boc ca ham trong
    `except Exception: logger.exception(...)`. Hau qua: 400 (HTML sai), 403
    (user chan bot), 429 (rate limit) deu ket thuc "binh thuong" ->
    `log_and_send` di nhanh thanh cong va ghi `status='sent', error_message=NULL`.

    Do la ly do 100/100 dong trong DB that deu `sent` voi `retry_count=0` —
    khong phai vi khong co loi, ma vi loi chua bao gio duoc ghi. Va vi cac dong
    `channel='website'` da duoc flush TRUOC khi gui, job do bi danh dau da-alert
    nen `get_already_alerted_ids` loai no ra VINH VIEN; co che retry cua admin
    cung khong tim thay gi vi khong co dong nao `status='failed'`.

    Nhanh thieu token cung raise chu khong `return`: khong co token thi tin
    KHONG duoc gui, ghi no la 'sent' van la noi doi.
    """
    if not TELEGRAM_BOT_TOKEN:
        raise TelegramSendError("TELEGRAM_BOT_TOKEN chua duoc cau hinh")

    client = await _get_http()
    try:
        resp = await client.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
        )
    except httpx.HTTPError as exc:
        raise TelegramSendError(f"Loi mang khi goi Telegram: {exc}") from exc

    try:
        payload = resp.json()
    except ValueError:
        payload = {}

    if resp.status_code == 200 and payload.get("ok"):
        return

    description = payload.get("description")
    retry_after = (payload.get("parameters") or {}).get("retry_after")
    raise TelegramSendError(
        f"Telegram tu choi (HTTP {resp.status_code}): {description or resp.text[:200]}",
        status_code=resp.status_code,
        description=description,
        retry_after=retry_after,
    )


async def generate_deep_link(
    db: AsyncSession, user_id: str
) -> DeepLinkResponse:
    result = await db.execute(
        select(TelegramConnection).where(TelegramConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()

    code = secrets.token_urlsafe(16)
    expires = datetime.now(VN_TZ).replace(tzinfo=None) + LINK_CODE_TTL

    if conn is None:
        conn = TelegramConnection(
            user_id=user_id,
            link_code=code,
            link_code_expires_at=expires,
            status="pending",
        )
        db.add(conn)
    else:
        conn.link_code = code
        conn.link_code_expires_at = expires
        if conn.status != "active":
            conn.status = "pending"

    await db.commit()

    return DeepLinkResponse(
        deep_link=f"https://t.me/{TELEGRAM_BOT_USERNAME}?start={code}",
        expires_in_seconds=int(LINK_CODE_TTL.total_seconds()),
    )


async def get_status(
    db: AsyncSession, user_id: str
) -> TelegramStatusResponse:
    result = await db.execute(
        select(TelegramConnection).where(TelegramConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()

    if conn is None:
        return TelegramStatusResponse(
            linked=False,
            status="none",
            job_alert_enabled=False,
        )

    sub_result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == user_id,
            AlertSubscription.alert_type == "job_match",
        )
    )
    sub = sub_result.scalar_one_or_none()

    return TelegramStatusResponse(
        linked=conn.status == "active",
        chat_id=conn.chat_id,
        telegram_username=conn.telegram_username,
        status=conn.status,
        linked_at=conn.linked_at,
        job_alert_enabled=sub.enabled if sub else False,
    )


async def unlink(db: AsyncSession, user_id: str) -> None:
    result = await db.execute(
        select(TelegramConnection).where(TelegramConnection.user_id == user_id)
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        return

    old_chat_id = conn.chat_id

    conn.status = "stopped"
    conn.chat_id = None
    conn.link_code = None
    conn.link_code_expires_at = None

    await db.execute(
        update(AlertSubscription)
        .where(AlertSubscription.user_id == user_id)
        .values(enabled=False)
    )
    await db.commit()

    if old_chat_id:
        await _send_message(
            old_chat_id,
            "Bot đã bị huỷ kết nối với tài khoản TalentPuse của bạn.",
        )


async def handle_webhook_update(db: AsyncSession, payload: TelegramUpdate) -> None:
    msg = payload.message
    if msg is None or msg.text is None:
        return

    text = msg.text.strip()

    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        code = parts[1] if len(parts) > 1 else None
        if code:
            await _handle_start(db, msg, code)
        else:
            await _send_message(
                msg.chat.id,
                "Chào bạn! Vui lòng tạo liên kết từ trang cá nhân TalentPuse để kết nối bot.",
            )
    elif text.startswith("/stop"):
        await _handle_stop(db, msg)
    elif text.startswith("/status"):
        await _handle_status_cmd(db, msg)
    else:
        await _send_message(
            msg.chat.id,
            "Xin chào! Dùng /status để kiểm tra trạng thái kết nối.",
        )


async def _handle_start(
    db: AsyncSession, msg: TelegramMessage, code: str
) -> None:
    result = await db.execute(
        select(TelegramConnection).where(TelegramConnection.link_code == code)
    )
    conn = result.scalar_one_or_none()

    if conn is None:
        await _send_message(
            msg.chat.id,
            "Mã liên kết không hợp lệ hoặc đã hết hạn.",
        )
        return

    if conn.link_code_expires_at and conn.link_code_expires_at < datetime.now(VN_TZ).replace(tzinfo=None):
        conn.link_code = None
        conn.link_code_expires_at = None
        await db.commit()
        await _send_message(
            msg.chat.id,
            "Mã liên kết đã hết hạn. Vui lòng tạo mã mới từ trang cá nhân.",
        )
        return

    old_conn_result = await db.execute(
        select(TelegramConnection).where(
            TelegramConnection.chat_id == msg.chat.id,
            TelegramConnection.id != conn.id,
        )
    )
    old_conn = old_conn_result.scalar_one_or_none()
    if old_conn is not None:
        old_conn.chat_id = None
        old_conn.status = "stopped"
        await db.execute(
            update(AlertSubscription)
            .where(AlertSubscription.user_id == old_conn.user_id)
            .values(enabled=False)
        )
        await db.flush()

    conn.chat_id = msg.chat.id
    conn.telegram_username = msg.from_.username if msg.from_ else None
    conn.status = "active"
    conn.linked_at = datetime.now(VN_TZ).replace(tzinfo=None)
    conn.link_code = None
    conn.link_code_expires_at = None

    sub_result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == conn.user_id,
            AlertSubscription.alert_type == "job_match",
        )
    )
    sub = sub_result.scalar_one_or_none()
    if sub is None:
        db.add(AlertSubscription(
            user_id=conn.user_id,
            alert_type="job_match",
            enabled=True,
        ))
    else:
        sub.enabled = True

    await db.commit()

    await _send_message(
        msg.chat.id,
        "Tài khoản TalentPuse đã được kết nối thành công!\n"
        "Bạn sẽ nhận thông báo việc làm phù hợp qua Telegram.\n\n"
        "Dùng /status để xem trạng thái, /stop để tắt thông báo.",
    )


async def _handle_stop(db: AsyncSession, msg: TelegramMessage) -> None:
    result = await db.execute(
        select(TelegramConnection).where(TelegramConnection.chat_id == msg.chat.id)
    )
    conn = result.scalar_one_or_none()

    if conn is None:
        await _send_message(msg.chat.id, "Tài khoản chưa được liên kết.")
        return

    conn.status = "stopped"
    # CHI tat subscription cua Telegram (`job_match`).
    #
    # Ban cu khong loc `alert_type`, nen `/stop` go luon `email_job_match` —
    # user go /stop trong Telegram de bot thoi lam phien thi mat luon email ma
    # ho da chu dong bat o mot noi hoan toan khac. Khong co gi bao cho ho biet,
    # va trang /profile van hien email "dang bat" cho toi lan tai lai (JA-11).
    await db.execute(
        update(AlertSubscription)
        .where(
            AlertSubscription.user_id == conn.user_id,
            AlertSubscription.alert_type == "job_match",
        )
        .values(enabled=False)
    )
    await db.commit()

    await _send_message(
        msg.chat.id,
        "Đã tắt thông báo việc làm qua Telegram. Dùng /start từ trang cá nhân để bật lại.\n"
        "Thông báo qua email (nếu bạn đã bật) vẫn giữ nguyên — quản lý tại talentpuse.io.vn/profile.",
    )


async def _handle_status_cmd(db: AsyncSession, msg: TelegramMessage) -> None:
    result = await db.execute(
        select(TelegramConnection).where(TelegramConnection.chat_id == msg.chat.id)
    )
    conn = result.scalar_one_or_none()

    if conn is None:
        await _send_message(msg.chat.id, "Tài khoản chưa được liên kết với TalentPuse.")
        return

    sub_result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == conn.user_id,
            AlertSubscription.alert_type == "job_match",
        )
    )
    sub = sub_result.scalar_one_or_none()
    alert_on = sub.enabled if sub else False

    status_icon = "🟢" if conn.status == "active" else "🔴"
    alert_icon = "🔔 Đang bật" if alert_on else "🔕 Đã tắt"
    linked_date = conn.linked_at.strftime("%d/%m/%Y") if conn.linked_at else "—"

    await _send_message(
        msg.chat.id,
        f"<b>Trạng thái kết nối TalentPuse</b>\n\n"
        f"{status_icon} Trạng thái: {conn.status}\n"
        f"{alert_icon}\n"
        f"📅 Kết nối từ: {linked_date}",
    )
