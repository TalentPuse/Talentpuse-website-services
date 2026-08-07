"""API key + quota ban hang — key tho chi lo 1 lan luc tao, luu sha256."""
from __future__ import annotations

import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_claim
from app.models.api_key import ApiKey

logger = logging.getLogger(__name__)

# Budget rate limit: 60 request / phut / key (spec §6:118).
RATE_LIMIT_PER_MINUTE = 60
# TTL moi slot giay: 61s > 1 phut nen slot cu roi khoi cua so truoc khi tai su dung.
_RATE_SLOT_TTL_SECONDS = 61


def generate_key() -> str:
    return secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


async def create_api_key(db: AsyncSession, name: str, quota_month: int = 10000) -> str:
    raw = generate_key()
    first_of_next_month = (
        datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        + timedelta(days=32)
    ).replace(day=1)
    db.add(ApiKey(
        name=name,
        key_hash=hash_key(raw),
        quota_month=quota_month,
        quota_reset_at=first_of_next_month,
    ))
    await db.commit()
    return raw


async def verify_key(db: AsyncSession, key: str) -> bool:
    """True neu key active va con quota (reset dau thang truoc khi dem)."""
    kh = hash_key(key)
    row = (await db.execute(select(ApiKey).where(ApiKey.key_hash == kh))).scalar_one_or_none()
    if row is None or not row.is_active:
        return False
    now = datetime.now(timezone.utc)
    if row.quota_reset_at <= now:
        row.used_count = 0
        row.quota_reset_at = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                              + timedelta(days=32)).replace(day=1)
    if row.used_count >= row.quota_month:
        await db.commit()
        return False
    row.used_count += 1
    await db.commit()
    return True


async def revoke_key(db: AsyncSession, key_hash_value: str) -> None:
    await db.execute(
        update(ApiKey).where(ApiKey.key_hash == key_hash_value).values(is_active=False)
    )
    await db.commit()


async def list_keys(db: AsyncSession) -> list[dict]:
    rows = (await db.execute(
        select(ApiKey).order_by(ApiKey.created_at.desc())
    )).scalars().all()
    return [
        {"id": str(r.id), "name": r.name, "quota_month": r.quota_month,
         "used_count": r.used_count, "is_active": r.is_active, "created_at": r.created_at}
        for r in rows
    ]


async def rate_limit_ok(key_hash_value: str) -> bool:
    """Rate limit 60 req/phut theo key. Redis chet -> fail-open (True).

    Dem theo luoi giay: moi giay trong phut la mot key claim rieng
    `paid:rl:{key_hash}:{epoch_giay}` (TTL 61s). Moi request chiem dung slot
    giay cua no bang `cache_claim` (SET NX EX nguyen tu) nen toi da 60 request
    thanh cong trong mot cua so 60s — slot da chiem (request thu 2+ trong cung
    giay) -> False.

    Fail-open trong ca hai lop: `cache_claim` tra True khi Redis chet / khong
    cau hinh, va try/except o day chan bat ky loi bat thuong nao khac — toi da
    chi lam request chay cham hon mot chut khi khong co cache, khong bao gio
    chan nham request hop le.
    """
    slot = f"paid:rl:{key_hash_value}:{int(time.time())}"
    try:
        return await cache_claim(slot, _RATE_SLOT_TTL_SECONDS)
    except Exception:
        # Fail-open lan nua o lop nay (ngoai hop dong cua cache_claim): loi
        # bat thuong tu Redis khong duoc chan request cua khach.
        logger.warning("rate limit check failed for key=%s, failing open", key_hash_value)
        return True
