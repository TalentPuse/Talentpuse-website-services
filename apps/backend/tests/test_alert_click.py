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


def test_link_theo_doi_doc_tu_cau_hinh_khong_hardcode():
    """Dia chi cong khai PHAI duoc suy ra tu cau hinh, khong viet cung.

    Hardcode thi moi tin alert gui tu local/staging deu tro ve PRODUCTION:
    nguoi test bam vao se nhay sang prod, va bo dem click cua prod nhan cac id
    khong he ton tai ben do. Du an nay da bi dung mot lop loi do hai lan
    (NEXT_PUBLIC_COPILOT_DOCK, AGUI_ENABLED) — ca hai deu la mot gia tri khong
    doc duoc tu moi truong.

    CO Y KHONG dung `importlib.reload`: reload `job_matcher` sinh ra mot doi
    tuong class JobMatcher MOI, trong khi `job_alert` van giu tham chieu toi
    class cu tu luc import. Test nao monkeypatch `JobMatcher.find_jobs` sau do
    se patch nham class va goi ham THAT — ban dau tien cua test nay da lam do
    `test_dispatch_lock.py` dung theo kieu do.
    """
    import inspect

    import app.api.redirect as rd
    import app.core.config as config
    import app.services.job_matcher as jm

    assert jm.TRACKING_BASE_URL == f"{config.PUBLIC_BASE_URL}/r"
    assert rd.HOME_URL == f"{config.PUBLIC_BASE_URL}/jobs"

    # Va khong con chuoi domain viet cung nao trong hai cho do.
    for mod in (jm, rd):
        src = inspect.getsource(mod)
        dong_hardcode = [
            d for d in src.splitlines()
            if "https://talentpuse.io.vn" in d and not d.lstrip().startswith("#")
        ]
        assert not dong_hardcode, f"{mod.__name__} con hardcode: {dong_hardcode}"


def test_base_url_khong_co_dau_gach_cuoi():
    """`https://x.vn/` va `https://x.vn` phai cho ra cung mot link.

    Khong chuan hoa thi link thanh `https://x.vn//r/<id>` — chay duoc o phan lon
    server nhung co proxy tra 404 cho duong dan hai dau gach.
    """
    import app.core.config as config

    assert not config.PUBLIC_BASE_URL.endswith("/")
