"""Smoke tests for all 5 endpoints — verifies shape, not business logic."""
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_overview():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/overview")
        assert r.status_code == 200
        d = r.json()
        assert "total_jobs" in d and isinstance(d["total_jobs"], int)
        assert "pct_with_salary" in d
        assert "avg_salary_million" in d


@pytest.mark.asyncio
async def test_top_skills():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/skills/top?limit=5")
        assert r.status_code == 200
        rows = r.json()
        assert isinstance(rows, list)
        assert len(rows) <= 5
        if rows:
            assert {"skill", "n_jobs", "pct_of_jobs"} <= rows[0].keys()


@pytest.mark.asyncio
async def test_highest_paying_skills():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/skills/highest-paying?limit=5")
        assert r.status_code == 200


@pytest.mark.asyncio
async def test_salary_by_level():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/salary/by-level")
        assert r.status_code == 200


@pytest.mark.asyncio
async def test_top_companies():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/companies/top?limit=5")
        assert r.status_code == 200
