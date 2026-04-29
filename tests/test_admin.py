"""Tests for admin dashboard endpoints."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.user import User


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _make_fake_user(*, is_admin: bool = False, **overrides):
    defaults = dict(
        id=uuid4(),
        email="admin@example.com",
        hashed_password="$2b$12$fakehash",
        full_name="Admin User",
        skills=["Python"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Hồ Chí Minh"],
        desired_titles=["AI Engineer"],
        is_active=True,
        is_admin=is_admin,
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
    async def _override():
        return fake_user
    app.dependency_overrides[get_current_user] = _override


# ─────────────────────────────────────────────
# Auth / access control
# ─────────────────────────────────────────────

ADMIN_ENDPOINTS = [
    ("GET", "/api/admin/stats"),
    ("GET", "/api/admin/users"),
    ("GET", "/api/admin/alert-logs"),
    ("GET", "/api/admin/config"),
    ("PUT", "/api/admin/config"),
    ("POST", "/api/admin/alerts/dispatch"),
]


@pytest.mark.asyncio
async def test_all_endpoints_require_auth():
    """Unauthenticated requests get 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        for method, path in ADMIN_ENDPOINTS:
            r = await c.request(method, path)
            assert r.status_code == 401, f"{method} {path} should require auth"


@pytest.mark.asyncio
async def test_all_endpoints_reject_non_admin():
    """Non-admin authenticated user gets 403."""
    _auth_override(_make_fake_user(is_admin=False))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        for method, path in ADMIN_ENDPOINTS:
            if method == "PUT" and path == "/api/admin/config":
                r = await c.request(method, path, json={})
            else:
                r = await c.request(method, path)
            assert r.status_code == 403, f"{method} {path} should reject non-admin"


# ─────────────────────────────────────────────
# GET /api/admin/stats
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_stats_success():
    _auth_override(_make_fake_user(is_admin=True))

    from app.schemas.admin import AdminStats
    mock_stats = AdminStats(
        total_users=10, active_users=8, telegram_linked=3,
        alerts_today=5, alerts_this_week=20, total_alerts=100,
    )

    with patch("app.api.admin.get_admin_stats", new_callable=AsyncMock, return_value=mock_stats):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/admin/stats")

    assert r.status_code == 200
    data = r.json()
    assert data["total_users"] == 10
    assert data["alerts_today"] == 5


# ─────────────────────────────────────────────
# GET /api/admin/users
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_users_list_paginated():
    _auth_override(_make_fake_user(is_admin=True))

    from app.schemas.admin import AdminUserList, AdminUserRow
    mock_list = AdminUserList(
        users=[
            AdminUserRow(
                id="abc", email="u@test.com", full_name="Test",
                is_active=True, is_admin=False, subscription_tier="free",
                skills=[], desired_titles=[], preferred_cities=[],
                telegram_status=None, telegram_username=None,
                alert_enabled=False, alerts_sent=0,
                created_at=datetime(2026, 4, 1),
            )
        ],
        total=1, page=1, per_page=20,
    )

    with patch("app.api.admin.list_users", new_callable=AsyncMock, return_value=mock_list):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/admin/users?page=1&per_page=20")

    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert len(data["users"]) == 1
    assert data["users"][0]["email"] == "u@test.com"


@pytest.mark.asyncio
async def test_users_search_filter():
    _auth_override(_make_fake_user(is_admin=True))

    from app.schemas.admin import AdminUserList
    mock_list = AdminUserList(users=[], total=0, page=1, per_page=20)

    with patch("app.api.admin.list_users", new_callable=AsyncMock, return_value=mock_list) as mock_fn:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/admin/users?search=test&is_active=true&tier=pro")

    assert r.status_code == 200
    mock_fn.assert_awaited_once()
    call_kwargs = mock_fn.call_args
    assert call_kwargs.kwargs["search"] == "test"
    assert call_kwargs.kwargs["is_active"] is True
    assert call_kwargs.kwargs["tier"] == "pro"


# ─────────────────────────────────────────────
# PUT /api/admin/users/{id}/toggle-active
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_toggle_user_active():
    _auth_override(_make_fake_user(is_admin=True))

    with patch("app.api.admin.toggle_user_active", new_callable=AsyncMock, return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.put(f"/api/admin/users/{uuid4()}/toggle-active?is_active=false")

    assert r.status_code == 200
    assert r.json()["is_active"] is False


@pytest.mark.asyncio
async def test_toggle_user_not_found():
    _auth_override(_make_fake_user(is_admin=True))

    with patch("app.api.admin.toggle_user_active", new_callable=AsyncMock, return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.put(f"/api/admin/users/{uuid4()}/toggle-active?is_active=false")

    assert r.status_code == 404


# ─────────────────────────────────────────────
# PUT /api/admin/users/{id}/tier
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_user_tier():
    _auth_override(_make_fake_user(is_admin=True))

    with patch("app.api.admin.update_user_tier", new_callable=AsyncMock, return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.put(f"/api/admin/users/{uuid4()}/tier", json={"tier": "pro"})

    assert r.status_code == 200
    assert r.json()["tier"] == "pro"


@pytest.mark.asyncio
async def test_update_user_tier_invalid():
    _auth_override(_make_fake_user(is_admin=True))

    with patch("app.api.admin.update_user_tier", new_callable=AsyncMock, return_value=False):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.put(f"/api/admin/users/{uuid4()}/tier", json={"tier": "invalid"})

    assert r.status_code == 400


# ─────────────────────────────────────────────
# GET /api/admin/alert-logs
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_alert_logs_list():
    _auth_override(_make_fake_user(is_admin=True))

    from app.schemas.admin import AlertLogList, AlertLogRow
    mock_list = AlertLogList(
        logs=[
            AlertLogRow(
                id="log1", user_email="u@test.com", user_full_name="Test User",
                source_job_id="123", job_title="AI Engineer",
                company_name="FPT", channel="telegram",
                sent_at=datetime(2026, 4, 29, 10, 0),
            )
        ],
        total=1, page=1, per_page=50,
    )

    with patch("app.api.admin.list_alert_logs", new_callable=AsyncMock, return_value=mock_list):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/admin/alert-logs")

    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["logs"][0]["job_title"] == "AI Engineer"


# ─────────────────────────────────────────────
# GET/PUT /api/admin/config
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_config_get():
    _auth_override(_make_fake_user(is_admin=True))

    from app.schemas.admin import SystemConfig
    mock_config = SystemConfig(
        alert_interval_seconds=7200, alert_loop_active=True,
        cors_origins=["http://localhost:8002"],
        telegram_bot_username="TalentPulseBot", telegram_bot_configured=True,
    )

    with patch("app.api.admin.get_system_config", return_value=mock_config):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/admin/config")

    assert r.status_code == 200
    assert r.json()["alert_interval_seconds"] == 7200


@pytest.mark.asyncio
async def test_config_update_interval():
    _auth_override(_make_fake_user(is_admin=True))

    from app.schemas.admin import SystemConfig
    mock_config = SystemConfig(
        alert_interval_seconds=3600, alert_loop_active=True,
        cors_origins=["http://localhost:8002"],
        telegram_bot_username="TalentPulseBot", telegram_bot_configured=True,
    )

    with patch("app.api.admin.update_system_config", return_value=mock_config):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.put("/api/admin/config", json={"alert_interval_seconds": 3600})

    assert r.status_code == 200
    assert r.json()["alert_interval_seconds"] == 3600


# ─────────────────────────────────────────────
# POST /api/admin/alerts/dispatch
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_manual():
    _auth_override(_make_fake_user(is_admin=True))

    with patch("app.api.admin.dispatch_alerts", new_callable=AsyncMock, return_value=3):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/admin/alerts/dispatch")

    assert r.status_code == 200
    assert r.json()["dispatched"] == 3
