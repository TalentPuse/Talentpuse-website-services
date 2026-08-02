"""Loai tru lan nhau cho vong dispatch alert (JA-01).

Lock nam tren MOT connection rieng, giu suot vong dispatch — khong nam tren
`AsyncSession` ma vong dispatch dang commit.

Vi sao khong dung lai session cua dispatch: `pg_try_advisory_lock` la lock
SESSION-LEVEL, gan vao backend connection. `AsyncSession.commit()` ket thuc
transaction va TRA connection ve pool, nen tu sau commit dau tien moi lenh
chay tren mot connection khac:

  - `pg_advisory_unlock` o cuoi chay nham connection -> tra `false`, Postgres
    log "you don't own a lock of type ExclusiveLock", va lock nam lai tren
    connection cu vo thoi han (engine khong co `pool_recycle`).
  - Moi dispatch sau do bi tu choi -> "already in progress" -> tra 0. Alert
    dung han cho toi khi container restart: khong exception, khong metric,
    khong ai biet.
  - Chieu nguoc lai con te hon: advisory lock RE-ENTRANT theo connection, nen
    mot dispatch tinh co nhan lai dung connection do se tai chiem lock va chay
    song song voi dispatch dang chay — gui trung Telegram lan email cho cung
    mot user, roi dung `uq_alert_log_user_job_channel` luc commit.

Danh doi da biet: connection giu lock lay tu chinh pool cua app
(`pool_size=5, max_overflow=0`), nen trong luc dispatch chay chi con 4
connection cho HTTP request. Chap nhan duoc vi dung dan quan trong hon, nhung
ap luc pool moi la van de that su — xem JA-15 (moi user ghim connection qua ca
HTTP call toi Telegram/Resend).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy import text

from app.core import database as db_module

logger = logging.getLogger(__name__)

ALERT_DISPATCH_LOCK_ID = 1234567890


@asynccontextmanager
async def alert_dispatch_lock() -> AsyncIterator[bool]:
    """Giu khoa dispatch tren connection rieng.

    Yield `True` neu lay duoc khoa, `False` neu mot dispatch khac dang chay.
    Ben goi PHAI kiem gia tri nay — vao than `with` khong dong nghia voi da co
    khoa.

    Chi giai phong khi that su dang giu: mot acquirer bi tu choi ma van goi
    `pg_advisory_unlock` se GO KHOA CUA NGUOI KHAC, bien loi "bi bo qua" thanh
    loi "hai dispatch chay song song".
    """
    if db_module.engine is None:
        raise RuntimeError("DB chua duoc init — khong the lay dispatch lock")

    async with db_module.engine.connect() as conn:
        row = await conn.execute(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": ALERT_DISPATCH_LOCK_ID}
        )
        if not row.scalar():
            yield False
            return

        try:
            yield True
        finally:
            # Nuot loi CO CHU DICH: neu unlock hong (connection chet giua
            # chung) thi Postgres da tu giai phong khoa luc session dong roi.
            # De no raise o day chi lam mot thu: che mat exception that su cua
            # vong dispatch, dung nhu JA-37 — operator debug sai huong.
            try:
                await conn.execute(
                    text("SELECT pg_advisory_unlock(:key)"),
                    {"key": ALERT_DISPATCH_LOCK_ID},
                )
            except Exception:
                logger.warning(
                    "Khong giai phong duoc dispatch lock; connection dong se tu giai phong",
                    exc_info=True,
                )
