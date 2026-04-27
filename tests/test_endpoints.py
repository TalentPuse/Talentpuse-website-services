"""Smoke tests for all 5 endpoints — verifies shape, not business logic.

Uses a mock DB connection so tests run without Postgres (CI-friendly).
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

FAKE_OVERVIEW = {
    "total_jobs": 42,
    "pct_with_salary": 65.0,
    "avg_salary_million": 25.5,
}

FAKE_SKILL = {"skill": "Python", "n_jobs": 30, "pct_of_jobs": 71.4}
FAKE_PAYING_SKILL = {"skill": "Spark", "n_jobs": 10, "avg_salary_million": 45.0}
FAKE_SALARY = {
    "level_city": "Senior - Ho Chi Minh",
    "job_level": "Senior",
    "city_canonical": "Ho Chi Minh",
    "p25_million": 20.0,
    "p50_million": 30.0,
    "p75_million": 40.0,
    "n_visible_jobs": 15,
}
FAKE_COMPANY = {
    "company_name": "FPT",
    "n_jobs": 25,
    "primary_city": "Ha Noi",
    "avg_views": 1200.0,
    "avg_salary_million": 22.0,
}


class FakeRecord(dict):
    pass


@asynccontextmanager
async def _mock_conn():
    conn = AsyncMock()

    async def _fetchrow(sql, *args):
        return FakeRecord(FAKE_OVERVIEW)

    async def _fetch(sql, *args):
        sql_lower = sql.lower()
        if "mart_skill_demand" in sql_lower and "avg_salary_vnd" in sql_lower:
            return [FakeRecord(FAKE_PAYING_SKILL)]
        if "mart_skill_demand" in sql_lower:
            return [FakeRecord(FAKE_SKILL)]
        if "mart_salary_by_level" in sql_lower:
            return [FakeRecord(FAKE_SALARY)]
        if "mart_company_hiring" in sql_lower:
            return [FakeRecord(FAKE_COMPANY)]
        return []

    conn.fetchrow = _fetchrow
    conn.fetch = _fetch
    yield conn


@pytest.fixture(autouse=True)
def patch_db(monkeypatch):
    monkeypatch.setattr("app.routers.overview.get_conn", _mock_conn)
    monkeypatch.setattr("app.routers.skills.get_conn", _mock_conn)
    monkeypatch.setattr("app.routers.salary.get_conn", _mock_conn)
    monkeypatch.setattr("app.routers.companies.get_conn", _mock_conn)


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
