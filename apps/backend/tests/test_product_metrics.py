"""Tests cho app/services/analytics/product_metrics.py.

Chay tren DB dev THAT (conftest khong dung schema rong), nen moi assert tuyet doi
kieu "dau == 1" chi dung neu cua so ngay dang do KHONG co du lieu nguoi that. Vi
vay cac test dung nam 2027: view app.user_activity_daily hien co du lieu tu
2026-05-21 den 2026-07-26. Neu chon ngay trong 2026 nhu ban plan viet, test se do
vi du lieu nguoi that lot vao cua so WAU/MAU — do la loi cua test, khong phai loi
cua code, va kieu do lam ca doi mat niem tin vao bo test.

_assert_window_empty() kiem tra tien de do ngay truoc khi seed, de neu sau nay co
ai do seed du lieu 2027 thi test bao dung nguyen nhan chu khong bao "dau != 1".
"""
from datetime import date, datetime, timezone

import pytest
from sqlalchemy import text

from app.services.analytics import product_metrics

# Xa hon moi du lieu that trong DB dev (max 2026-07-26).
ON_DATE = date(2027, 7, 10)


async def _assert_window_empty(db_session, on_date: date) -> None:
    """Cua so MAU (30 ngay) quanh on_date phai sach truoc khi test seed vao."""
    n = (
        await db_session.execute(
            text(
                # CAST bat buoc: khong co no Postgres suy :d thanh integer trong
                # bieu thuc ":d - 30" va bao "operator does not exist: date > integer".
                "SELECT count(*) FROM app.user_activity_daily "
                "WHERE activity_date > CAST(:d AS date) - 30 "
                "  AND activity_date <= CAST(:d AS date)"
            ),
            {"d": on_date},
        )
    ).scalar()
    assert n == 0, (
        f"cua so 30 ngay truoc {on_date} da co {n} dong hoat dong — "
        "chon lai ON_DATE, dung sua assert cua test"
    )


async def _mark_active(db_session, user_id, day: date):
    """Insert a real activity row the view will pick up (a chat room).

    05:00 UTC = 12:00 gio VN, tuc chac chan roi vao dung ngay `day` theo lich VN
    du view co doi mui gio. Neu dat 00:00 UTC thi no la 07:00 VN cung ngay, con
    23:00 UTC lai la ngay hom sau — test se do vi mui gio chu khong vi logic.
    """
    await db_session.execute(
        text(
            "INSERT INTO app.chat_rooms (id, user_id, created_at) "
            "VALUES (gen_random_uuid(), CAST(:uid AS uuid), :ts)"
        ),
        {
            "uid": str(user_id),
            "ts": datetime(day.year, day.month, day.day, 5, 0, tzinfo=timezone.utc),
        },
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_dau_counts_only_the_given_day(db_session, seed_user):
    await _assert_window_empty(db_session, ON_DATE)
    await _mark_active(db_session, seed_user.id, date(2027, 7, 10))
    await _mark_active(db_session, seed_user.id, date(2027, 6, 1))

    stats = await product_metrics.active_users(db_session, ON_DATE)

    assert stats.dau == 1


@pytest.mark.asyncio
async def test_wau_covers_the_trailing_seven_days(db_session, seed_user):
    await _assert_window_empty(db_session, ON_DATE)
    await _mark_active(db_session, seed_user.id, date(2027, 7, 5))

    stats = await product_metrics.active_users(db_session, ON_DATE)

    assert stats.dau == 0
    assert stats.wau == 1
    assert stats.mau == 1


@pytest.mark.asyncio
async def test_stickiness_is_dau_over_mau(db_session, seed_user):
    await _assert_window_empty(db_session, ON_DATE)
    await _mark_active(db_session, seed_user.id, date(2027, 7, 10))

    stats = await product_metrics.active_users(db_session, ON_DATE)

    assert stats.stickiness == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_stickiness_is_zero_when_nobody_is_active(db_session):
    await _assert_window_empty(db_session, ON_DATE)

    stats = await product_metrics.active_users(db_session, ON_DATE)

    assert stats.dau == 0
    assert stats.mau == 0
    assert stats.stickiness == 0.0  # must not raise ZeroDivisionError


@pytest.mark.asyncio
async def test_funnel_counts_are_monotonically_non_increasing(db_session, seed_user):
    funnel = await product_metrics.activation_funnel(db_session)

    assert funnel.signed_up >= funnel.profile_completed
    assert funnel.profile_completed >= funnel.channel_enabled
    assert funnel.channel_enabled >= 0


@pytest.mark.asyncio
async def test_retention_cohorts_returns_rows_with_rates_in_range(db_session, seed_user):
    """seed_user vua duoc tao nen chac chan roi vao mot cohort cua 8 tuan gan nhat."""
    rows = await product_metrics.retention_cohorts(db_session, weeks=8)

    assert rows, "phai co it nhat cohort chua seed_user vua tao"
    for r in rows:
        assert r.size >= 1
        assert 0.0 <= r.d1 <= 1.0
        assert 0.0 <= r.d7 <= 1.0
        assert 0.0 <= r.d30 <= 1.0
