"""API paid /api/v1 — auth key, quota, aggregate tren jd_insight."""
import json

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

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


async def _seed_aggregate(db_session):
    """Seed rare values (prefix tptest) — khong dung trung stale rows cua bang.

    Xoa rows tptest cu truoc (neu session truoc crash de lai) de count deterministic.
    """
    await db_session.execute(text("DELETE FROM app.jd_insight WHERE source = 'tptest'"))
    await db_session.commit()
    base = {"summary": {"role_summary": "x", "seniority_hint": "mid"},
            "skills": {"hard": [], "soft": [], "tools": [], "languages": [], "certifications": []},
            "requirements": {}, "responsibilities": [], "benefits": [], "keywords": [], "extras": [],
            "job": {"job_category": "tptest-cat-a", "city_canonical": "tptest-city-a"}}
    base["skills"]["hard"] = ["tptest-skill"]
    base["skills"]["tools"] = ["tptest-tool"]
    base["skills"]["languages"] = [{"lang": "tptest-lang", "level": "N3"}]
    base["benefits"] = ["tptest-benefit"]
    base["requirements"]["years_experience"] = {"min": 4}
    await upsert_insight(db_session, "tptest", "1", base)
    base["skills"]["hard"] = ["tptest-skill"]
    base["skills"]["tools"] = ["tptest-tool"]
    base["skills"]["languages"] = [{"lang": "tptest-lang", "level": None}]
    base["benefits"] = ["tptest-benefit"]
    base["requirements"]["years_experience"] = {"min": 0}
    base["job"] = {"job_category": "tptest-cat-b", "city_canonical": "tptest-city-b"}
    await upsert_insight(db_session, "tptest", "2", base)


async def _del_aggregate(db_session):
    await db_session.execute(text("DELETE FROM app.jd_insight WHERE source = 'tptest'"))
    await db_session.commit()


async def test_tools_top(db_session):
    await _seed_aggregate(db_session)
    try:
        raw = await create_api_key(db_session, "Tools")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/tools/top", headers={"X-API-Key": raw})
        assert r.status_code == 200
        rows = r.json()
        assert rows[0] == {"tool": "tptest-tool", "n_jobs": 2}
        assert all(set(row) == {"tool", "n_jobs"} for row in rows)
    finally:
        await _del_aggregate(db_session)


async def test_languages_top_kem_level(db_session):
    await _seed_aggregate(db_session)
    try:
        raw = await create_api_key(db_session, "Langs")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/languages/top", headers={"X-API-Key": raw})
        assert r.status_code == 200
        rows = r.json()
        # GROUP BY lang + level: (tptest-lang, N3) va (tptest-lang, null) la 2 dong rieng
        assert {"lang": "tptest-lang", "level": "N3", "n_jobs": 1} in rows
        assert {"lang": "tptest-lang", "level": None, "n_jobs": 1} in rows
        assert all(set(row) == {"lang", "level", "n_jobs"} for row in rows)
    finally:
        await _del_aggregate(db_session)


async def test_benefits_top(db_session):
    await _seed_aggregate(db_session)
    try:
        raw = await create_api_key(db_session, "Benefits")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/benefits/top", headers={"X-API-Key": raw})
        assert r.status_code == 200
        rows = r.json()
        # tie-order khong deterministic voi "Bao hiem" (seed cua test khac) —
        # assert ton tai + count, khong phu thuoc vi tri rows[0]
        assert {"benefit": "tptest-benefit", "n_jobs": 2} in rows
        assert all(set(row) == {"benefit", "n_jobs"} for row in rows)
    finally:
        await _del_aggregate(db_session)


async def test_requirements_experience(db_session):
    await _seed_aggregate(db_session)
    try:
        raw = await create_api_key(db_session, "Exp")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/requirements/experience", headers={"X-API-Key": raw})
        assert r.status_code == 200
        rows = r.json()
        assert {"bucket": "4+ nam", "n_jobs": 1} in rows
        assert {"bucket": "0-1 nam", "n_jobs": 1} in rows
    finally:
        await _del_aggregate(db_session)


async def test_skills_top_loc_theo_category(db_session):
    await _seed_aggregate(db_session)
    try:
        raw = await create_api_key(db_session, "Cat")
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.get("/api/v1/skills/top?category=tptest-cat-a",
                            headers={"X-API-Key": raw})
        assert r.status_code == 200
        rows = r.json()
        # chi job tptest-1 (cat-a) con lai — n_jobs = 1, khong tinh job tptest-2 (cat-b)
        assert rows[0] == {"skill": "tptest-skill", "n_jobs": 1}
        assert all(set(row) == {"skill", "n_jobs"} for row in rows)
    finally:
        await _del_aggregate(db_session)
