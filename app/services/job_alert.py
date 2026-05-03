"""Alert dispatch orchestrator.

Thin layer that loads active users, delegates matching to JobMatcher,
and coordinates logging + sending.
"""
from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.models.telegram import TelegramConnection
from app.models.user import User
from app.services.job_matcher import JobMatcher
from app.services.telegram import _send_message

logger = logging.getLogger(__name__)


async def dispatch_alerts(db: AsyncSession) -> int:
    """Find matching jobs for all active users and send alerts.

    Returns total number of new jobs alerted.
    """
    result = await db.execute(
        select(User, TelegramConnection.chat_id)
        .outerjoin(
            TelegramConnection,
            (TelegramConnection.user_id == User.id)
            & (TelegramConnection.status == "active")
            & (TelegramConnection.chat_id.isnot(None)),
        )
        .where(User.is_active == True)  # noqa: E712
        .where(User.skills.any())  # non-empty skills array
    )

    rows = result.all()
    total_sent = 0
    matcher = JobMatcher(db)

    for row in rows:
        user: User = row[0]
        chat_id: int | None = row[1]

        try:
            jobs = await matcher.find_jobs(user)
            if not jobs:
                continue

            sent = await matcher.log_and_send(user, jobs, chat_id, _send_message)
            await db.commit()

            total_sent += sent
            logger.info("Sent %d alerts to user %s (telegram=%s)", sent, user.id, bool(chat_id))

        except Exception:
            logger.exception("Failed to dispatch alerts for user %s", user.id)
            await db.rollback()

    return total_sent
