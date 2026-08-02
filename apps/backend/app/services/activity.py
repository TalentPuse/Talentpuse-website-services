"""Ghi lai lan hoat dong gan nhat cua user — best-effort.

Ghi tren MOI request da xac thuc se them mot round-trip DB vao tung loi goi API.
Thay vao do mot claim tren Redis chi cho phep toi da MOT lan UPDATE moi
user moi gio; do phan giai theo gio da du de tinh DAU/WAU/MAU, vi ba con so
nay deu chi hoi "trong ngay/tuan/thang do user co xuat hien khong".

Hai rang buoc phai giu, ca hai deu la loi that neu vi pham:

1. Ham nay chay BEN TRONG `get_current_user`. No nem ra loi = MOI endpoint can
   dang nhap tra 500. Vi vay moi duong that bai deu bi nuot va chi ghi log.
2. Engine cua backend la pool_size=5, max_overflow=0. Cai claim tren Redis phai
   duoc kiem TRUOC khi cham vao DB, neu khong thi dung 5 connection de ghi mot
   con so telemetry trong khi request that dang doi.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_claim
from app.models.user import User

logger = logging.getLogger(__name__)

ACTIVITY_TTL_SECONDS = 3600


async def touch_user_activity(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """Ghi nhan `user_id` vua hoat dong. Tra True neu that su ghi mot dong."""
    # datetime.now(timezone.utc), KHONG dung utcnow(): utcnow() tra ve gia tri
    # naive, ghi vao cot timestamptz se bi coi la gio dia phuong cua session.
    # Repo da dinh dung loi nay 3 lan (JA-25, JA-T1, JA-T2).
    now = datetime.now(timezone.utc)

    # Khoa claim gan theo gio UTC chu khong chi dua vao TTL: neu chi dua vao TTL
    # thi cua so 1 tieng troi theo thoi diem request dau tien cua tung user, rat
    # kho suy luan khi doi chieu so lieu.
    claim_key = f"active:{user_id}:{now.strftime('%Y%m%d%H')}"

    if not await cache_claim(claim_key, ACTIVITY_TTL_SECONDS):
        return False

    try:
        await db.execute(
            update(User).where(User.id == user_id).values(last_active_at=now)
        )
        await db.commit()
        return True
    except Exception:
        # Nuot loi co chu dich: day la telemetry. Mot cot last_active_at cu hon
        # thuc te chap nhan duoc; mot request dang nhap that bai thi khong.
        logger.warning("touch_user_activity failed for user %s", user_id, exc_info=True)
        await db.rollback()
        return False
