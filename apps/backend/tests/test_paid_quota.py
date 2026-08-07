"""API key + quota — hash, tao, verify, reset dau thang, rate limit fail-open."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.api_key import ApiKey
from app.services.paid_quota import (
    create_api_key, generate_key, hash_key, list_keys, rate_limit_ok, revoke_key, verify_key,
)


def test_generate_key_khac_nhau_va_hash_on_dinh():
    k1, k2 = generate_key(), generate_key()
    assert k1 != k2 and len(k1) >= 32
    assert hash_key(k1) == hash_key(k1)
    assert hash_key(k1) != hash_key(k2)


async def test_create_va_verify(db_session):
    raw = await create_api_key(db_session, "Test Khach", quota_month=100)
    assert await verify_key(db_session, raw) is True
    assert await verify_key(db_session, "sai-key") is False


async def test_het_quota_bi_tu_choi(db_session):
    raw = await create_api_key(db_session, "Quota Nho", quota_month=3)
    await verify_key(db_session, raw)
    await verify_key(db_session, raw)
    await verify_key(db_session, raw)
    assert await verify_key(db_session, raw) is False  # qua quota


async def test_reset_dau_thang(db_session):
    from sqlalchemy import select

    raw = await create_api_key(db_session, "Reset", quota_month=1)
    await verify_key(db_session, raw)
    assert await verify_key(db_session, raw) is False
    # Gia lap sang dau thang sau
    row = (await db_session.execute(select(ApiKey).where(ApiKey.key_hash == hash_key(raw)))).scalar_one()
    row.quota_reset_at = datetime.now(timezone.utc) - timedelta(days=1)
    await db_session.commit()
    assert await verify_key(db_session, raw) is True


async def test_revoke(db_session):
    raw = await create_api_key(db_session, "Bi Thu Hoi")
    await revoke_key(db_session, hash_key(raw))
    assert await verify_key(db_session, raw) is False


async def test_list_keys(db_session):
    await create_api_key(db_session, "A")
    await create_api_key(db_session, "B", quota_month=5)
    keys = await list_keys(db_session)
    assert {k["name"] for k in keys} >= {"A", "B"}
    assert all("key_hash" not in k for k in keys)  # khong lo key tho/hash


def test_rate_limit_fail_open(monkeypatch):
    # Redis chet -> True (fail-open)
    monkeypatch.setattr("app.services.paid_quota._rate_limiter", None)
    assert rate_limit_ok("abc") is True
