"""Test endpoint chi tiet job."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core import database as db_module
from app.main import app


async def _token(c: AsyncClient) -> str:
    email = "jobfit-detail@local.dev"
    await c.post("/api/auth/signup", json={
        "email": email, "password": "Test12345!", "full_name": "Detail QA"})
    r = await c.post("/api/auth/login", json={"email": email, "password": "Test12345!"})
    return r.json()["access_token"]


@pytest.mark.asyncio
async def test_job_khong_ton_tai_tra_404_chu_khong_phai_500(warehouse):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        tok = await _token(c)
        r = await c.get("/api/jobs/linkedin/khong-ton-tai-9999",
                        headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_can_dang_nhap():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/api/jobs/linkedin/abc")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_tra_ve_jd_va_match_null_khi_ho_so_rong(warehouse):
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        row = (await db.execute(text(
            "SELECT source, source_job_id FROM dbt_dev_gold.fct_jobs_daily "
            "WHERE is_active LIMIT 1"))).first()
    if row is None:
        pytest.skip("kho du lieu local rong")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        tok = await _token(c)
        r = await c.get(f"/api/jobs/{row[0]}/{row[1]}",
                        headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    body = r.json()
    assert body["source_job_id"] == row[1]
    assert body["description"] is not None
    # Tai khoan vua tao chua co ky nang/vi tri/thanh pho => ho so rong.
    assert body["match"] is None, "ho so rong PHAI tra null, khong duoc tra 0"
