"""Tests cho link do CTR /r/{alert_log_id}.

Diem then chot: mot loi trong khau DEM click khong bao gio duoc lam nguoi dung
mat cu bam. Neu /r/ tra 500 khi gap id la, thi mot link cu trong email tu vai
thang truoc se dan thang vao trang loi thay vi ve trang viec lam.
"""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.alert_log import AlertLog


@pytest.mark.asyncio
async def test_redirect_records_click_and_302s(client, db_session, seed_user):
    log = AlertLog(
        user_id=seed_user.id,
        source_job_id="job-42",
        job_source="vietnamworks",
        channel="telegram",
        sent_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    resp = await client.get(f"/r/{log.id}", follow_redirects=False)

    assert resp.status_code == 302
    assert resp.headers["location"].startswith("http")

    reloaded = (
        await db_session.execute(select(AlertLog).where(AlertLog.id == log.id))
    ).scalar_one()
    await db_session.refresh(reloaded)
    assert reloaded.clicked_at is not None
    assert reloaded.click_count == 1


@pytest.mark.asyncio
async def test_second_click_increments_but_keeps_first_timestamp(
    client, db_session, seed_user
):
    log = AlertLog(
        user_id=seed_user.id,
        source_job_id="job-43",
        job_source="vietnamworks",
        channel="email",
        sent_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    await client.get(f"/r/{log.id}", follow_redirects=False)
    reloaded = (
        await db_session.execute(select(AlertLog).where(AlertLog.id == log.id))
    ).scalar_one()
    await db_session.refresh(reloaded)
    first = reloaded.clicked_at

    await client.get(f"/r/{log.id}", follow_redirects=False)
    await db_session.refresh(reloaded)

    assert reloaded.click_count == 2
    # `clicked_at` la thoi diem bam LAN DAU — do la con so dung de tinh do tre
    # tu luc gui den luc bam. Ghi de moi lan bam se pha chi so do vinh vien vi
    # gia tri cu khong luu o dau ca.
    assert reloaded.clicked_at == first


@pytest.mark.asyncio
async def test_unknown_id_redirects_home_instead_of_500(client):
    resp = await client.get(f"/r/{uuid.uuid4()}", follow_redirects=False)
    assert resp.status_code == 302
