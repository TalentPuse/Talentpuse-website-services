"""Tests for chat API endpoints."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app


# ─── Helpers ────────────────────────────────────────────

def _make_user(**overrides):
    from app.models.user import User

    defaults = dict(
        id=uuid4(),
        email="test@example.com",
        hashed_password="$2b$12$fake",
        full_name="Test User",
        skills=["Python"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Ho Chi Minh"],
        desired_titles=["AI Engineer"],
        is_active=True,
        is_admin=False,
        subscription_tier="free",
        experience_level="senior",
        university=None,
        graduation_year=None,
        open_to_internship=False,
        part_time_ok=False,
        created_at=datetime(2026, 1, 15, 10, 0, 0),
        updated_at=datetime(2026, 1, 15, 10, 0, 0),
    )
    defaults.update(overrides)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


USER_A = _make_user()
USER_B = _make_user(id=uuid4(), email="other@example.com")


class _ScalarResult:
    def __init__(self, items):
        self._items = items

    def scalars(self):
        return self

    def all(self):
        return self._items

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class MockDB:
    """In-memory mock for chat tests."""

    def __init__(self):
        self.rooms = {}
        self.messages = {}

    async def get(self, model, pk):
        return self.rooms.get(str(pk))

    async def execute(self, stmt):
        return _ScalarResult([])

    def add(self, obj):
        pass

    async def commit(self):
        pass

    async def refresh(self, obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid4()
        if not hasattr(obj, "created_at") or obj.created_at is None:
            obj.created_at = datetime(2026, 5, 21, 10, 0, 0)
        if not hasattr(obj, "updated_at") or obj.updated_at is None:
            obj.updated_at = datetime(2026, 5, 21, 10, 0, 0)

    async def delete(self, obj):
        self.rooms.pop(str(obj.id), None)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


MOCK_DB = MockDB()


async def _fake_get_db():
    yield MOCK_DB


def _fake_current_user(user=USER_A):
    async def _dep():
        return user
    return _dep


@pytest.fixture(autouse=True)
def _override_deps():
    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[get_current_user] = _fake_current_user(USER_A)
    yield
    app.dependency_overrides.clear()


# ─── Tests ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_rooms():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/chat/rooms")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.asyncio
async def test_create_room():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/chat/rooms", json={"title": "Test Room"})
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Test Room"
    assert "id" in body


@pytest.mark.asyncio
async def test_create_room_default_title():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/chat/rooms", json={})
    assert r.status_code == 201
    assert r.json()["title"] == "Cuộc trò chuyện mới"


@pytest.mark.asyncio
async def test_delete_room_not_found():
    fake_id = str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.delete(f"/api/chat/rooms/{fake_id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_messages_room_not_found():
    fake_id = str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(f"/api/chat/rooms/{fake_id}/messages")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_send_message_room_not_found():
    fake_id = str(uuid4())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            f"/api/chat/rooms/{fake_id}/messages",
            json={"content": "Hello"},
        )
    assert r.status_code == 404
