"""Alert dispatch orchestrator.

Thin layer that loads active users, delegates matching to JobMatcher,
and coordinates logging + sending via telegram and email.
"""
from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert_log import AlertLog
from app.models.telegram import AlertSubscription, TelegramConnection
from app.models.user import User
from app.services.email import send_job_alert_email
from app.services.job_matcher import JobMatcher
from app.services.telegram import _send_message

logger = logging.getLogger(__name__)

EMAIL_ALERT_TYPE = "email_job_match"
ALERT_DISPATCH_LOCK_ID = 1234567890


async def _is_email_enabled(db: AsyncSession, user_id) -> bool:
    result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == user_id,
            AlertSubscription.alert_type == EMAIL_ALERT_TYPE,
            AlertSubscription.enabled == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none() is not None


async def dispatch_alerts(db: AsyncSession, source: str = "unknown") -> int:
    """Find matching jobs for all active users and send alerts.

    Args:
        db: Database session
        source: Which trigger source initiated this dispatch
                ("background_loop", "admin_manual", "cron_webhook", "etl_inline",
                 "vnw_etl", "itviec_etl", "linkedin_etl", "alert_dispatch_flow")

    Returns total number of new jobs alerted.
    """
    # Acquire advisory lock to prevent concurrent dispatches
    lock_result = await db.execute(text(f"SELECT pg_try_advisory_lock({ALERT_DISPATCH_LOCK_ID})"))
    if not lock_result.scalar():
        logger.warning("Alert dispatch already in progress, skipping (source=%s)", source)
        return 0

    try:
        result = await db.execute(
            select(User, TelegramConnection.chat_id)
            .outerjoin(
                TelegramConnection,
                (TelegramConnection.user_id == User.id)
                & (TelegramConnection.status == "active")
                & (TelegramConnection.chat_id.isnot(None)),
            )
            .where(User.is_active == True)  # noqa: E712
            .where(func.array_length(User.skills, 1) > 0)
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

                # Send email if user subscribed
                email_enabled = await _is_email_enabled(db, user.id)
                if email_enabled and user.email:
                    try:
                        email_result = await send_job_alert_email(
                            to=user.email,
                            user_name=user.full_name,
                            jobs=jobs,
                        )
                        if email_result.success:
                            for j in jobs:
                                db.add(AlertLog(
                                    user_id=user.id,
                                    source_job_id=j.source_job_id,
                                    channel="email",
                                    status="sent",
                                    source=source,
                                ))
                        else:
                            # Log failed email for potential retry
                            for j in jobs:
                                db.add(AlertLog(
                                    user_id=user.id,
                                    source_job_id=j.source_job_id,
                                    channel="email",
                                    status="failed",
                                    error_message=email_result.error[:500] if email_result.error else "Unknown error",
                                    source=source,
                                ))
                    except Exception as exc:
                        logger.exception("Email send failed for user %s", user.id)
                        # Log failed entries
                        for j in jobs:
                            db.add(AlertLog(
                                user_id=user.id,
                                source_job_id=j.source_job_id,
                                channel="email",
                                status="failed",
                                error_message=str(exc)[:500],
                                source=source,
                            ))

                await db.commit()

                total_sent += sent
                logger.info("Sent %d alerts to user %s (telegram=%s, email=%s)", sent, user.id, bool(chat_id), email_enabled)

            except Exception:
                logger.exception("Failed to dispatch alerts for user %s", user.id)
                await db.rollback()

        return total_sent
    finally:
        # Release advisory lock
        await db.execute(text(f"SELECT pg_advisory_unlock({ALERT_DISPATCH_LOCK_ID})"))
