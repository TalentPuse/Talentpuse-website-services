"""API paid /api/v1 — auth key, quota, aggregate tren jd_insight."""
import json

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.jd_insight_repo import upsert_insight
from app.services.paid_quota import create_api_key


async def _seed_insights(db_session):
    base = {"summary": {"role_summary": "x", "seniority_hint": "mid"},
            "skills": {"hard": [], "soft": [], "tools": [], "languages": [], "certifications": []},
            "requirements": {}, "responsibilities": [], "benefits": [], "keywords": [], "extras": []}
    base["skills"]["hard"] = ["python"]
    base["benefits"] = ["Bao hiem"]
    await upsert_insight(db_session, "topcv", "1", base)
    base["skills"]["hard"] = ["python", "pytorch"]
    await upsert_insight(db_session, "topcv", "2", base)


async def test_required_key(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top")
    assert r.status_code == 401


async def test_sai_key_401(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top", headers={"X-API-Key": "sai"})
    assert r.status_code == 401


async def test_skills_top_hop_le(db_session):
    await _seed_insights(db_session)
    raw = await create_api_key(db_session, "Test")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top", headers={"X-API-Key": raw})
    assert r.status_code == 200
    rows = r.json()
    assert rows[0]["skill"] == "python"
    assert rows[0]["n_jobs"] == 2


async def test_het_quota_429(db_session):
    raw = await create_api_key(db_session, "Nho", quota_month=0)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/skills/top", headers={"X-API-Key": raw})
    assert r.status_code == 429


async def test_job_insight_endpoint(db_session):
    await _seed_insights(db_session)
    raw = await create_api_key(db_session, "Job")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/jobs/topcv/1/insight", headers={"X-API-Key": raw})
    assert r.status_code == 200
    assert r.json()["skills"]["hard"] == ["python"]


async def test_job_insight_khong_co_404(db_session):
    await _seed_insights(db_session)
    raw = await create_api_key(db_session, "Job404")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/jobs/topcv/khong-ton-tai/insight", headers={"X-API-Key": raw})
    assert r.status_code == 404
