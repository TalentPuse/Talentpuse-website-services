"""Tests for Telegram bot link + webhook endpoints."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app
from app.schemas.telegram import DeepLinkResponse, TelegramStatusResponse


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _make_fake_user(**overrides):
    from app.models.user import User

    defaults = dict(
        id=uuid4(),
        email="tg@example.com",
        hashed_password="$2b$12$fakehash",
        full_name="Nguyễn Telegram",
        skills=["Python"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Hồ Chí Minh"],
        desired_titles=["AI Engineer"],
        is_active=True,
        is_admin=False,
        subscription_tier="free",
        created_at=datetime(2026, 1, 15),
        updated_at=datetime(2026, 1, 15),
    )
    defaults.update(overrides)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


async def _fake_get_db():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def _override_db():
    app.dependency_overrides[get_db] = _fake_get_db
    yield
    app.dependency_overrides.clear()


def _auth_override(fake_user):
    from app.core.security import get_current_user

    async def _override():
        return fake_user

    app.dependency_overrides[get_current_user] = _override


# Read the secret the app actually runs with rather than restating it here — a
# test that hardcodes the value keeps passing after the real secret is rotated.
from app.core.config import TELEGRAM_WEBHOOK_SECRET as WEBHOOK_SECRET  # noqa: E402
WEBHOOK_HEADERS = {"X-Telegram-Bot-Api-Secret-Token": WEBHOOK_SECRET}


# ─────────────────────────────────────────────
# POST /api/telegram/link
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_link_returns_deep_link():
    fake_user = _make_fake_user()
    _auth_override(fake_user)

    resp = DeepLinkResponse(
        deep_link="https://t.me/TalentPulseBot?start=abc123",
        expires_in_seconds=900,
    )

    with patch("app.api.telegram.generate_deep_link", return_value=resp):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/link",
                headers={"Authorization": "Bearer fake"},
            )

    assert r.status_code == 200
    body = r.json()
    assert body["deep_link"].startswith("https://t.me/")
    assert body["expires_in_seconds"] == 900


@pytest.mark.asyncio
async def test_link_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/telegram/link")
    assert r.status_code == 401


# ─────────────────────────────────────────────
# GET /api/telegram/status
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_status_not_linked():
    fake_user = _make_fake_user()
    _auth_override(fake_user)

    resp = TelegramStatusResponse(
        linked=False, status="none", job_alert_enabled=False,
    )

    with patch("app.api.telegram.get_status", return_value=resp):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get(
                "/api/telegram/status",
                headers={"Authorization": "Bearer fake"},
            )

    assert r.status_code == 200
    assert r.json()["linked"] is False


@pytest.mark.asyncio
async def test_status_linked():
    fake_user = _make_fake_user()
    _auth_override(fake_user)

    resp = TelegramStatusResponse(
        linked=True,
        chat_id=123456,
        telegram_username="testuser",
        status="active",
        linked_at=datetime(2026, 4, 28),
        job_alert_enabled=True,
    )

    with patch("app.api.telegram.get_status", return_value=resp):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get(
                "/api/telegram/status",
                headers={"Authorization": "Bearer fake"},
            )

    assert r.status_code == 200
    body = r.json()
    assert body["linked"] is True
    assert body["telegram_username"] == "testuser"
    assert body["job_alert_enabled"] is True


@pytest.mark.asyncio
async def test_status_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/telegram/status")
    assert r.status_code == 401


# ─────────────────────────────────────────────
# DELETE /api/telegram/link
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_unlink_success():
    fake_user = _make_fake_user()
    _auth_override(fake_user)

    with patch("app.api.telegram.unlink", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.delete(
                "/api/telegram/link",
                headers={"Authorization": "Bearer fake"},
            )

    assert r.status_code == 204


@pytest.mark.asyncio
async def test_unlink_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.delete("/api/telegram/link")
    assert r.status_code == 401


# ─────────────────────────────────────────────
# POST /api/telegram/webhook
# ─────────────────────────────────────────────

def _make_update(text="/start TESTCODE", chat_id=999):
    return {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "from": {"id": chat_id, "first_name": "Test", "username": "testuser"},
            "chat": {"id": chat_id},
            "text": text,
        },
    }


@pytest.mark.asyncio
async def test_webhook_invalid_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/telegram/webhook",
            json=_make_update(),
            headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_webhook_missing_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/telegram/webhook", json=_make_update())
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_webhook_start_command():
    with patch("app.api.telegram.handle_webhook_update", new_callable=AsyncMock) as mock_handle:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/webhook",
                json=_make_update("/start ABC123"),
                headers=WEBHOOK_HEADERS,
            )

    assert r.status_code == 200
    assert r.json() == {"ok": True}
    mock_handle.assert_awaited_once()


@pytest.mark.asyncio
async def test_webhook_stop_command():
    with patch("app.api.telegram.handle_webhook_update", new_callable=AsyncMock) as mock_handle:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/webhook",
                json=_make_update("/stop"),
                headers=WEBHOOK_HEADERS,
            )

    assert r.status_code == 200
    mock_handle.assert_awaited_once()


@pytest.mark.asyncio
async def test_webhook_status_command():
    with patch("app.api.telegram.handle_webhook_update", new_callable=AsyncMock) as mock_handle:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/webhook",
                json=_make_update("/status"),
                headers=WEBHOOK_HEADERS,
            )

    assert r.status_code == 200
    mock_handle.assert_awaited_once()


@pytest.mark.asyncio
async def test_webhook_handler_error_still_200():
    """Webhook must return 200 even if handler raises, to prevent Telegram retries."""
    with patch(
        "app.api.telegram.handle_webhook_update",
        new_callable=AsyncMock,
        side_effect=RuntimeError("boom"),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/webhook",
                json=_make_update(),
                headers=WEBHOOK_HEADERS,
            )

    assert r.status_code == 200
    assert r.json() == {"ok": True}


# ─────────────────────────────────────────────
# Service unit — _send_message
# ─────────────────────────────────────────────

def _mock_client(*, status_code: int = 200, payload: dict | None = None, text: str = ""):
    """httpx client gia tra ve mot response cu the."""
    resp = MagicMock()
    resp.status_code = status_code
    resp.text = text
    resp.json = MagicMock(return_value=payload if payload is not None else {"ok": True})

    client = AsyncMock()
    client.post = AsyncMock(return_value=resp)
    client.is_closed = False
    return client


@pytest.mark.asyncio
async def test_send_message_thanh_cong_khong_raise():
    from app.services.telegram import _send_message

    client = _mock_client(payload={"ok": True, "result": {"message_id": 1}})
    with patch("app.services.telegram._http", client), \
         patch("app.services.telegram.TELEGRAM_BOT_TOKEN", "fake-token"):
        await _send_message(123, "test message")

    client.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_send_message_raise_khi_loi_mang():
    """Mat mang PHAI noi ra ngoai (JA-03).

    Test nay truoc day ten la `test_send_message_network_error` va khang dinh
    dieu NGUOC LAI ("must not raise"). No khong sai luc viet — no mo ta dung
    code luc do — nhung chinh no la thu giu bug o nguyen tai cho:
    `_send_message` nuot moi loi, `log_and_send` di nhanh thanh cong va ghi
    `status='sent'` cho mot tin chua bao gio toi noi. CI xanh suot.
    """
    import httpx

    from app.services.telegram import TelegramSendError, _send_message

    client = AsyncMock()
    client.post = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
    client.is_closed = False

    with patch("app.services.telegram._http", client), \
         patch("app.services.telegram.TELEGRAM_BOT_TOKEN", "fake-token"):
        with pytest.raises(TelegramSendError):
            await _send_message(123, "test message")


@pytest.mark.asyncio
async def test_send_message_raise_khi_thieu_token():
    """Thieu token = tin KHONG duoc gui, nen phai raise chu khong `return`.

    Ban cu log warning roi return em — ben goi khong phan biet duoc voi gui
    thanh cong, va ghi `sent` vao alert_logs cho mot tin khong ton tai.
    """
    from app.services.telegram import TelegramSendError, _send_message

    with patch("app.services.telegram.TELEGRAM_BOT_TOKEN", ""):
        with pytest.raises(TelegramSendError):
            await _send_message(123, "test message")


@pytest.mark.asyncio
async def test_send_message_raise_khi_telegram_tra_400():
    """HTTP 200 khong con la dieu kien du — phai doc ca `ok` trong body.

    400 `can't parse entities` la thu xay ra khi tieu de crawl ve co `<` hoac
    `&` chua escape (JA-07): Telegram tu choi CA BATCH.
    """
    from app.services.telegram import TelegramSendError, _send_message

    client = _mock_client(
        status_code=400,
        payload={"ok": False, "description": "Bad Request: can't parse entities"},
    )
    with patch("app.services.telegram._http", client), \
         patch("app.services.telegram.TELEGRAM_BOT_TOKEN", "fake-token"):
        with pytest.raises(TelegramSendError) as exc:
            await _send_message(123, "<Urgent> & co")

    assert exc.value.status_code == 400
    assert "parse entities" in (exc.value.description or "")


@pytest.mark.asyncio
async def test_send_message_giu_lai_retry_after_cua_429():
    """429 phai mang theo `retry_after` de con biet cho bao lau (JA-18)."""
    from app.services.telegram import TelegramSendError, _send_message

    client = _mock_client(
        status_code=429,
        payload={"ok": False, "description": "Too Many Requests", "parameters": {"retry_after": 17}},
    )
    with patch("app.services.telegram._http", client), \
         patch("app.services.telegram.TELEGRAM_BOT_TOKEN", "fake-token"):
        with pytest.raises(TelegramSendError) as exc:
            await _send_message(123, "test")

    assert exc.value.retry_after == 17


@pytest.mark.asyncio
async def test_send_message_raise_khi_body_khong_phai_json():
    """502 tu proxy tra HTML: `.json()` no, khong duoc de no thanh 'sent'."""
    from app.services.telegram import TelegramSendError, _send_message

    resp = MagicMock()
    resp.status_code = 502
    resp.text = "<html>Bad Gateway</html>"
    resp.json = MagicMock(side_effect=ValueError("not json"))
    client = AsyncMock()
    client.post = AsyncMock(return_value=resp)
    client.is_closed = False

    with patch("app.services.telegram._http", client), \
         patch("app.services.telegram.TELEGRAM_BOT_TOKEN", "fake-token"):
        with pytest.raises(TelegramSendError) as exc:
            await _send_message(123, "test")

    assert exc.value.status_code == 502
