from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.models.alert_log import AlertLog
from app.models.chat import ChatRoom


@pytest.mark.asyncio
async def test_user_action_marks_was_active(db_session, seed_user):
    db_session.add(
        ChatRoom(
            user_id=seed_user.id,
            created_at=datetime(2026, 7, 1, 5, 0, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    rows = (
        await db_session.execute(
            text(
                "SELECT activity_date, was_active, was_alerted "
                "FROM app.user_activity_daily WHERE user_id = :uid"
            ),
            {"uid": str(seed_user.id)},
        )
    ).mappings().all()

    assert len(rows) == 1
    assert rows[0]["was_active"] is True
    assert rows[0]["was_alerted"] is False


@pytest.mark.asyncio
async def test_alert_alone_is_not_counted_as_activity(db_session, seed_user):
    db_session.add(
        AlertLog(
            user_id=seed_user.id,
            source_job_id="job-1",
            channel="website",
            sent_at=datetime(2026, 7, 2, 5, 0, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    row = (
        await db_session.execute(
            text(
                "SELECT was_active, was_alerted FROM app.user_activity_daily "
                "WHERE user_id = :uid"
            ),
            {"uid": str(seed_user.id)},
        )
    ).mappings().one()

    assert row["was_alerted"] is True
    assert row["was_active"] is False


@pytest.mark.asyncio
async def test_day_boundary_uses_vietnam_calendar_day(db_session, seed_user):
    # 2026-07-03 18:30 UTC == 2026-07-04 01:30 in Asia/Ho_Chi_Minh.
    db_session.add(
        ChatRoom(
            user_id=seed_user.id,
            created_at=datetime(2026, 7, 3, 18, 30, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    row = (
        await db_session.execute(
            text(
                "SELECT activity_date FROM app.user_activity_daily WHERE user_id = :uid"
            ),
            {"uid": str(seed_user.id)},
        )
    ).mappings().one()

    assert str(row["activity_date"]) == "2026-07-04"
