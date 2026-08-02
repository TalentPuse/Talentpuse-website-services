from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.user import User


@pytest.mark.asyncio
async def test_last_active_at_defaults_to_null_and_accepts_aware_datetime(db_session, seed_user):
    result = await db_session.execute(select(User).where(User.id == seed_user.id))
    user = result.scalar_one()
    assert user.last_active_at is None

    stamp = datetime(2026, 8, 2, 3, 30, tzinfo=timezone.utc)
    user.last_active_at = stamp
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.id == seed_user.id))
    reloaded = result.scalar_one()
    assert reloaded.last_active_at is not None
    assert reloaded.last_active_at.tzinfo is not None
    assert reloaded.last_active_at == stamp
