from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.user import User
from app.services import activity


@pytest.mark.asyncio
async def test_touch_writes_once_then_throttles(db_session, seed_user, monkeypatch):
    claims = {"count": 0}

    async def fake_claim(key: str, ttl_seconds: int) -> bool:
        claims["count"] += 1
        return claims["count"] == 1  # first call wins, later calls throttled

    monkeypatch.setattr(activity, "cache_claim", fake_claim)

    assert await activity.touch_user_activity(db_session, seed_user.id) is True
    assert await activity.touch_user_activity(db_session, seed_user.id) is False

    result = await db_session.execute(select(User).where(User.id == seed_user.id))
    user = result.scalar_one()
    assert user.last_active_at is not None
    assert user.last_active_at.tzinfo is not None


@pytest.mark.asyncio
async def test_touch_is_fail_open_when_redis_unavailable(db_session, seed_user, monkeypatch):
    async def claim_always_true(key: str, ttl_seconds: int) -> bool:
        return True

    monkeypatch.setattr(activity, "cache_claim", claim_always_true)

    assert await activity.touch_user_activity(db_session, seed_user.id) is True


@pytest.mark.asyncio
async def test_touch_never_raises_when_the_update_fails(db_session, seed_user, monkeypatch):
    async def claim_always_true(key: str, ttl_seconds: int) -> bool:
        return True

    async def boom(*args, **kwargs):
        raise RuntimeError("db exploded")

    monkeypatch.setattr(activity, "cache_claim", claim_always_true)
    monkeypatch.setattr(db_session, "execute", boom)

    # Activity tracking is best-effort telemetry: it must never break the request.
    assert await activity.touch_user_activity(db_session, seed_user.id) is False
