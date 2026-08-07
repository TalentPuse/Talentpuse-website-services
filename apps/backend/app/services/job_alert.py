"""Alert dispatch orchestrator.

Thin layer that loads active users, delegates matching to JobMatcher,
and coordinates logging + sending via telegram and email.
"""
from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dispatch_lock import ALERT_DISPATCH_LOCK_ID, alert_dispatch_lock  # noqa: F401
from app.models.alert_log import AlertLog
from app.models.telegram import AlertSubscription, TelegramConnection
from app.models.user import User
from app.services.email import send_job_alert_email
from app.services.job_matcher import JobMatcher
from app.services.telegram import _send_message

logger = logging.getLogger(__name__)

EMAIL_ALERT_TYPE = "email_job_match"
# ALERT_DISPATCH_LOCK_ID tung duoc dinh nghia o day; gio re-export tu
# `app.core.dispatch_lock` de caller cu khong gay. Nguon that su la module do.


async def _is_email_enabled(db: AsyncSession, user_id) -> bool:
    result = await db.execute(
        select(AlertSubscription).where(
            AlertSubscription.user_id == user_id,
            AlertSubscription.alert_type == EMAIL_ALERT_TYPE,
            AlertSubscription.enabled == True,  # noqa: E712
        )
    )
    return result.scalar_one_or_none() is not None


def _parse_channels(channels: str | None) -> tuple[str, ...]:
    """Doc header `X-Dispatch-Channels`: "telegram" | "email" | "both" (mac dinh).

    Tra ve tuple kenh duoc giai quyet o lan dispatch nay. Gia tri la lai ve
    "both" — khong lam chet webhook vi mot header go sai.
    """
    if channels == "telegram":
        return ("telegram",)
    if channels == "email":
        return ("email",)
    return ("telegram", "email")


async def dispatch_alerts(
    db: AsyncSession,
    source: str = "unknown",
    channels: tuple[str, ...] = ("telegram", "email"),
) -> int:
    """Find matching jobs for all active users and send alerts.

    Args:
        db: Database session
        source: Which trigger source initiated this dispatch
                ("background_loop", "admin_manual", "cron_webhook", "etl_inline",
                 "vnw_etl", "itviec_etl", "linkedin_etl", "alert_dispatch_flow")
        channels: subset cua ("telegram", "email") — kenh duoc giai quyet lan nay.
            - "telegram": chi gui telegram, dedup theo website marker nhu cu.
            - "email": chi gui email, dedup RIENG theo dong email 'sent' — khong
              chan nham job telegram da gui, nen user co ca 2 kenh van nhan ca 2
              khi hai pipeline chay doc lap (va dong email 'failed' duoc thu lai
              o slot sau).

    Returns total number of new jobs alerted.
    """
    # Khoa nam tren connection RIENG (app.core.dispatch_lock), khong nam tren
    # `db`: vong lap ben duoi commit sau moi user, ma commit tra connection ve
    # pool — khoa se troi theo connection do va khong bao gio go duoc (JA-01).
    async with alert_dispatch_lock() as lay_duoc_khoa:
        if not lay_duoc_khoa:
            logger.warning("Alert dispatch already in progress, skipping (source=%s)", source)
            return 0
        return await _dispatch_alerts_locked(db, source, channels)


async def _get_email_alerted_ids(db: AsyncSession, user_id) -> set[tuple[str | None, str]]:
    """Cac (job_source, source_job_id) da GUI EMAIL thanh cong cho user.

    Dedup rieng cua pipeline email. CHI dem dong 'sent': dong 'failed' phai
    duoc thu lai o slot sau (khong giong website marker, von khong het han).
    """
    result = await db.execute(
        select(AlertLog.job_source, AlertLog.source_job_id).where(
            AlertLog.user_id == user_id,
            AlertLog.channel == "email",
            AlertLog.status == "sent",
        )
    )
    return {(r[0], r[1]) for r in result.all()}


async def _dispatch_alerts_locked(
    db: AsyncSession, source: str, channels: tuple[str, ...]
) -> int:
    """Than cua `dispatch_alerts`, chay khi da CHAC CHAN giu khoa dispatch."""
    want_tg = "telegram" in channels
    want_email = "email" in channels

    result = await db.execute(
        select(User, TelegramConnection.chat_id)
        .outerjoin(
            TelegramConnection,
            (TelegramConnection.user_id == User.id)
            & (TelegramConnection.status == "active")
            & (TelegramConnection.chat_id.isnot(None)),
        )
        .where(User.is_active == True)  # noqa: E712
        # Truoc day chi xet `skills` — dieu do loai nham CA PHAN KHUC student
        # (JA-14): nhanh student cua JobMatcher chi doc `desired_titles`, no
        # khong dung `skills` de tim viec. Student khai title day du nhung chua
        # nhap skills thi `find_jobs` khong bao gio duoc goi toi, va ho khong
        # xuat hien trong bat ky log nao vi chua tung buoc vao vong lap.
        .where(
            (func.array_length(User.skills, 1) > 0)
            | (func.array_length(User.desired_titles, 1) > 0)
        )
    )

    rows = result.all()
    total_sent = 0
    matcher = JobMatcher(db)

    for row in rows:
        user: User = row[0]
        chat_id: int | None = row[1]

        email_enabled = await _is_email_enabled(db, user.id)
        # Khong co kenh nao duoc chon ma user dang ky -> bo qua, KHONG ghi
        # marker nao (cung tinh than JA-52: khong co kenh gui thi khong dot
        # hang doi dedup).
        if not ((want_tg and chat_id) or (want_email and email_enabled)):
            continue

        try:
            # Pipeline email dedup rieng theo email rows nen duoc phep bo qua
            # website marker (find_jobs bao gom ca job da bao qua telegram).
            # Pipeline telegram van dedup theo website marker nhu cu.
            jobs = await matcher.find_jobs(user, include_alerted=(want_email and not want_tg))
            if not jobs:
                continue

            # Truyen `source` xuong: log_and_send ghi cac dong website/telegram,
            # tuc la 2/3 so alert. Bo qua tham so nay la ly do 63% ban ghi that
            # co source = NULL va trang admin dispatch-history khong doc duoc.
            sent = 0
            if want_tg:
                sent = await matcher.log_and_send(
                    user, jobs, chat_id, _send_message,
                    source=source, email_enabled=(want_email and email_enabled),
                )

            if want_email and email_enabled and user.email:
                email_alerted = await _get_email_alerted_ids(db, user.id)
                email_jobs = [
                    j for j in jobs
                    if (j.source, j.source_job_id) not in email_alerted
                ]
                if email_jobs:
                    try:
                        email_result = await send_job_alert_email(
                            to=user.email,
                            user_name=user.full_name,
                            jobs=email_jobs,
                            user_id=user.id,
                        )
                        # Upsert (ON CONFLICT) chu khong insert: unique constraint
                        # (user_id, job_source, source_job_id, channel) chi cho
                        # MOT dong email cho mot job — retry phai UPDATE dong
                        # 'failed' cu thanh 'sent', khong duoc insert dong moi.
                        status = "sent" if email_result.success else "failed"
                        err = (
                            (email_result.error or "Unknown error")[:500]
                            if not email_result.success else None
                        )
                        for j in email_jobs:
                            await _upsert_email_log(
                                db, user.id, j.source, j.source_job_id,
                                status, err, source,
                            )
                        # Chi tinh vao total khi pipeline nay la nguon duy nhat:
                        # khi ca 2 kenh cung chay, telegram da tinh job do roi.
                        if not want_tg and email_result.success:
                            total_sent += len(email_jobs)
                    except Exception as exc:
                        logger.exception("Email send failed for user %s", user.id)
                        for j in email_jobs:
                            await _upsert_email_log(
                                db, user.id, j.source, j.source_job_id,
                                "failed", str(exc)[:500], source,
                            )

            await db.commit()

            total_sent += sent
            logger.info(
                "Sent %d alerts to user %s (telegram=%s, email=%s)",
                sent, user.id, bool(chat_id and want_tg), email_enabled,
            )

        except Exception:
            logger.exception("Failed to dispatch alerts for user %s", user.id)
            await db.rollback()

    return total_sent


async def _upsert_email_log(
    db: AsyncSession,
    user_id,
    job_source: str,
    source_job_id: str,
    status: str,
    error_message: str | None,
    source: str,
) -> None:
    """Insert an email-channel alert log, or update it on conflict.

    Khoa xung dot phai khop DUNG unique constraint hien tai
    `(user_id, job_source, source_job_id, channel)` (migration 017) — dung khoa
    cu thi Postgres bao "no unique or exclusion constraint matching the ON
    CONFLICT specification" va ca lan gui bi rollback SAU KHI mail da bay di.
    """
    await db.execute(text("""
        INSERT INTO app.alert_logs (id, user_id, job_source, source_job_id, channel, status, error_message, source)
        VALUES (gen_random_uuid(), :uid, :jsrc, :jid, 'email', :status, :err, :src)
        ON CONFLICT (user_id, job_source, source_job_id, channel) DO UPDATE
        SET status = EXCLUDED.status,
            error_message = EXCLUDED.error_message,
            source = EXCLUDED.source,
            sent_at = now()
    """), {
        "uid": user_id,
        "jsrc": job_source,
        "jid": source_job_id,
        "status": status,
        "err": error_message,
        "src": source,
    })


async def email_all_users(db: AsyncSession, source: str = "admin_manual") -> dict:
    """Force-send an email job alert to EVERY active user-role (non-admin) user.

    Unlike dispatch_alerts, this ignores per-user subscription and the
    "already alerted" dedup (include_alerted=True) so a manual blast reliably
    reaches all users who have any matching jobs. Users with no matches are
    skipped (no empty emails).

    Returns {"emailed", "skipped_no_jobs", "failed", "total_users"}.
    """
    # Cung ly do nhu `dispatch_alerts`: vong lap ben duoi commit sau moi user
    # nen khoa khong duoc nam tren `db` (JA-01).
    async with alert_dispatch_lock() as lay_duoc_khoa:
        if not lay_duoc_khoa:
            logger.warning("email_all_users: dispatch lock busy, skipping (source=%s)", source)
            return {"emailed": 0, "skipped_no_jobs": 0, "failed": 0, "total_users": 0, "locked": True}
        return await _email_all_users_locked(db, source)


async def _email_all_users_locked(db: AsyncSession, source: str) -> dict:
    """Than cua `email_all_users`, chay khi da CHAC CHAN giu khoa dispatch."""
    # CHI gui cho nguoi da bat `email_job_match` (JA-10).
    #
    # Ban cu chi loc `is_active AND NOT is_admin` va CO TINH bo qua
    # AlertSubscription, nen nguoi da bam huy nhan mail van nhan. Cong voi
    # JA-22 (mail khong co link huy) thi ho khong con cach nao khac ngoai bam
    # "Report spam" — va Gmail/Yahoo ha uy tin CA DOMAIN `talentpuse.io.vn`,
    # tuc la lam hong email cho toan bo user chu khong rieng nguoi bam.
    #
    # Neu that su can mot dot gui cho tat ca (vd thong bao van hanh), do la mot
    # tinh nang khac va phai co su dong y rieng — khong duoc muon lai duong
    # alert viec lam.
    result = await db.execute(
        select(User)
        .join(
            AlertSubscription,
            (AlertSubscription.user_id == User.id)
            & (AlertSubscription.alert_type == EMAIL_ALERT_TYPE)
            & (AlertSubscription.enabled == True),  # noqa: E712
        )
        .where(
            User.is_active == True,  # noqa: E712
            User.is_admin == False,  # noqa: E712
        )
    )
    users: list[User] = result.scalars().all()
    logger.info(
        "email_all_users: %d nguoi dang bat email_job_match (source=%s)", len(users), source
    )

    emailed = 0
    skipped = 0
    failed = 0
    matcher = JobMatcher(db)

    for user in users:
        if not user.email:
            continue
        try:
            # include_alerted=True so the blast always finds current top matches
            jobs = await matcher.find_jobs(user, include_alerted=True)
            if not jobs:
                skipped += 1
                continue

            email_result = await send_job_alert_email(
                to=user.email,
                user_name=user.full_name,
                jobs=jobs,
                user_id=user.id,
            )
            status = "sent" if email_result.success else "failed"
            err = (email_result.error or "Unknown error")[:500] if not email_result.success else None
            for j in jobs:
                await _upsert_email_log(db, user.id, j.source, j.source_job_id, status, err, source)
            await db.commit()

            if email_result.success:
                emailed += 1
            else:
                failed += 1
                logger.error("email_all_users: send failed for user %s: %s", user.id, email_result.error)
        except Exception:
            logger.exception("email_all_users: error for user %s", user.id)
            await db.rollback()
            failed += 1

    logger.info(
        "email_all_users done (source=%s): emailed=%d skipped=%d failed=%d total=%d",
        source, emailed, skipped, failed, len(users),
    )
    return {
        "emailed": emailed,
        "skipped_no_jobs": skipped,
        "failed": failed,
        "total_users": len(users),
    }
