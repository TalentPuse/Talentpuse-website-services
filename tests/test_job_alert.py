"""Tests for job alert matching + dispatch."""
from __future__ import annotations

import re
from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app
from app.services.job_alert import LEVEL_MAP, _UserProxy, find_matching_jobs, format_job_message


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

async def _fake_get_db():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def _override_db():
    app.dependency_overrides[get_db] = _fake_get_db
    yield
    app.dependency_overrides.clear()


CRON_HEADERS = {"X-Cron-Secret": "dev-webhook-secret"}


# ─────────────────────────────────────────────
# POST /api/telegram/alerts/dispatch
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_requires_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/telegram/alerts/dispatch")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dispatch_wrong_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/telegram/alerts/dispatch",
            headers={"X-Cron-Secret": "wrong"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dispatch_success():
    with patch("app.api.telegram.dispatch_alerts", new_callable=AsyncMock, return_value=5):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/alerts/dispatch",
                headers=CRON_HEADERS,
            )

    assert r.status_code == 200
    assert r.json() == {"dispatched": 5}


@pytest.mark.asyncio
async def test_dispatch_zero():
    with patch("app.api.telegram.dispatch_alerts", new_callable=AsyncMock, return_value=0):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/alerts/dispatch",
                headers=CRON_HEADERS,
            )

    assert r.status_code == 200
    assert r.json() == {"dispatched": 0}


# ─────────────────────────────────────────────
# POST /api/admin/alerts/dispatch-internal
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_internal_dispatch_no_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/alerts/dispatch-internal")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_internal_dispatch_wrong_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/admin/alerts/dispatch-internal",
            headers={"X-Webhook-Secret": "bad-secret"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_internal_dispatch_success():
    with patch("app.api.admin.dispatch_alerts", new_callable=AsyncMock, return_value=12):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/admin/alerts/dispatch-internal",
                headers={"X-Webhook-Secret": "dev-webhook-secret"},
            )

    assert r.status_code == 200
    assert r.json() == {"dispatched": 12}


# ─────────────────────────────────────────────
# format_job_message
# ─────────────────────────────────────────────

def test_format_single_job():
    jobs = [
        {
            "source": "vietnamworks",
            "source_job_id": "123",
            "title": "AI Engineer",
            "company_name": "FPT",
            "city_canonical": "HCMC",
            "job_level": "Experienced",
            "job_category": "AI Engineer",
            "salary_m": 30.0,
            "score": 72.5,
        }
    ]
    msg = format_job_message(jobs)
    assert "việc làm" in msg
    assert "AI Engineer" in msg
    assert "FPT" in msg
    assert "HCMC" in msg
    assert "30 triệu" in msg
    assert "VietnamWorks" in msg


def test_format_multiple_jobs():
    jobs = [
        {
            "source": "vietnamworks",
            "source_job_id": "1",
            "title": "Data Engineer",
            "company_name": "VNG",
            "city_canonical": "HCMC",
            "job_level": "Senior",
            "job_category": "Data Engineer",
            "salary_m": 25.0,
            "score": 65.0,
        },
        {
            "source": "itviec",
            "source_job_id": "abc-slug",
            "title": "AI Engineer",
            "company_name": "Grab",
            "city_canonical": "Hanoi",
            "job_level": "Mid",
            "job_category": None,
            "salary_m": None,
            "score": 40.0,
        },
    ]
    msg = format_job_message(jobs)
    assert "việc làm" in msg
    assert "Data Engineer" in msg
    assert "AI Engineer" in msg
    assert "VietnamWorks" in msg
    assert "ITviec" in msg


def test_format_no_salary():
    jobs = [
        {
            "source": "vietnamworks",
            "source_job_id": "99",
            "title": "Backend Dev",
            "company_name": "Startup",
            "city_canonical": None,
            "job_level": None,
            "job_category": None,
            "salary_m": None,
            "score": 25.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "Backend Dev" in msg
    assert "triệu" not in msg


def test_format_with_level():
    jobs = [
        {
            "source": "vietnamworks",
            "source_job_id": "42",
            "title": "Senior Data Analyst",
            "company_name": "Bosch",
            "city_canonical": "HCMC",
            "job_level": "Mid-level",
            "job_category": "Data Analyst",
            "salary_m": 25.0,
            "score": 80.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "📊 Mid-level" in msg
    assert "Bosch" in msg
    assert "⭐ 80%" in msg


def test_format_no_level():
    jobs = [
        {
            "source": "itviec",
            "source_job_id": "devops-engineer",
            "title": "DevOps Engineer",
            "company_name": "TechCorp",
            "city_canonical": "Hanoi",
            "job_level": None,
            "job_category": None,
            "salary_m": 20.0,
            "score": 45.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "📊" not in msg
    assert "DevOps Engineer" in msg
    assert "ITviec" in msg


def test_format_uses_source_url():
    jobs = [
        {
            "source": "itviec",
            "source_job_id": "3715",
            "source_url": "https://itviec.com/job/data-engineer-aws-gcp-up-to-2700-3715",
            "title": "Data Engineer",
            "company_name": "TechCo",
            "city_canonical": "HCMC",
            "job_level": None,
            "job_category": None,
            "salary_m": None,
            "score": 50.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "itviec.com/job/data-engineer-aws-gcp-up-to-2700-3715" in msg


def test_format_fallback_without_source_url():
    jobs = [
        {
            "source": "itviec",
            "source_job_id": "999",
            "title": "DevOps",
            "company_name": "X",
            "city_canonical": None,
            "job_level": None,
            "job_category": None,
            "salary_m": None,
            "score": 30.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "itviec.com" in msg


# ─────────────────────────────────────────────
# LEVEL_MAP correctness
# ─────────────────────────────────────────────

CANONICAL_LEVELS = {"Intern/Student", "Fresher/Entry level", "Mid-level", "Senior", "Manager", "Director+"}


class TestLevelMap:
    """Verify LEVEL_MAP only references canonical job_level values."""

    def test_all_values_are_canonical(self):
        for level_key, levels in LEVEL_MAP.items():
            for lv in levels:
                assert lv in CANONICAL_LEVELS, (
                    f"LEVEL_MAP['{level_key}'] contains non-canonical value '{lv}'"
                )

    def test_no_dead_raw_values(self):
        dead = {"Experienced (non-manager)", "Not Applicable", "Mid-Senior level",
                "Associate", "Entry level", "Internship", "Executive", "Director"}
        for level_key, levels in LEVEL_MAP.items():
            for lv in levels:
                assert lv not in dead, (
                    f"LEVEL_MAP['{level_key}'] contains dead raw value '{lv}'"
                )

    def test_student_gets_intern_and_fresher(self):
        assert LEVEL_MAP["student"] == ["Intern/Student", "Fresher/Entry level"]

    def test_fresher_gets_entry_and_mid(self):
        assert LEVEL_MAP["fresher"] == ["Fresher/Entry level", "Mid-level"]

    def test_experienced_gets_mid_and_senior(self):
        assert LEVEL_MAP["experienced"] == ["Mid-level", "Senior"]

    def test_manager_gets_senior_manager_director(self):
        assert LEVEL_MAP["manager"] == ["Senior", "Manager", "Director+"]


# ─────────────────────────────────────────────
# find_matching_jobs SQL generation
# ─────────────────────────────────────────────

def _extract_level_clause(sql_text: str) -> str:
    """Extract the level filter clause from generated SQL."""
    # The level clause appears after "AND " near the end of WHERE
    # It's either "f.job_level = ANY(:levels)" or "true"
    m = re.search(r"AND (f\.job_level = ANY\(:levels\)|true)\s*\)", sql_text)
    assert m, f"Could not find level clause in SQL:\n{sql_text}"
    return m.group(1)


@pytest.mark.asyncio
async def test_student_sql_has_level_filter():
    """Student profile should produce a hard level filter."""
    captured = {}

    class FakeDB:
        async def execute(self, sql, params):
            captured["sql"] = str(sql)
            captured["params"] = params

            class R:
                def all(self):
                    return []

            return R()

    user = _UserProxy(
        id="00000000-0000-0000-0000-000000000001",
        skills=["python"],
        desired_titles=["Data Engineer"],
        preferred_cities=["HCMC"],
        desired_salary_min=None,
        experience_level="student",
    )

    await find_matching_jobs(FakeDB(), user)

    clause = _extract_level_clause(captured["sql"])
    assert clause == "f.job_level = ANY(:levels)", f"Expected level filter, got: {clause}"
    assert captured["params"]["levels"] == ["Intern/Student", "Fresher/Entry level"]


@pytest.mark.asyncio
async def test_experienced_sql_has_level_filter():
    """Experienced profile should filter to Mid-level + Senior."""
    captured = {}

    class FakeDB:
        async def execute(self, sql, params):
            captured["sql"] = str(sql)
            captured["params"] = params

            class R:
                def all(self):
                    return []

            return R()

    user = _UserProxy(
        id="00000000-0000-0000-0000-000000000002",
        skills=["sql"],
        desired_titles=["Data Analyst"],
        preferred_cities=[],
        desired_salary_min=None,
        experience_level="experienced",
    )

    await find_matching_jobs(FakeDB(), user)

    assert captured["params"]["levels"] == ["Mid-level", "Senior"]


@pytest.mark.asyncio
async def test_no_experience_level_no_filter():
    """User with no experience_level should get no level filter (level_clause = true)."""
    captured = {}

    class FakeDB:
        async def execute(self, sql, params):
            captured["sql"] = str(sql)
            captured["params"] = params

            class R:
                def all(self):
                    return []

            return R()

    user = _UserProxy(
        id="00000000-0000-0000-0000-000000000003",
        skills=["python"],
        desired_titles=["AI Engineer"],
        preferred_cities=[],
        desired_salary_min=None,
        experience_level=None,
    )

    await find_matching_jobs(FakeDB(), user)

    clause = _extract_level_clause(captured["sql"])
    assert clause == "true"
    assert "levels" not in captured["params"]


@pytest.mark.asyncio
async def test_student_sql_rejects_senior_jobs():
    """Verify student SQL would NOT match Senior jobs by checking ANY array."""
    captured = {}

    class FakeDB:
        async def execute(self, sql, params):
            captured.update(params)

            class R:
                def all(self):
                    return []

            return R()

    user = _UserProxy(
        id="00000000-0000-0000-0000-000000000004",
        skills=[],
        desired_titles=[],
        preferred_cities=[],
        desired_salary_min=None,
        experience_level="student",
    )

    await find_matching_jobs(FakeDB(), user)

    allowed = captured["levels"]
    assert "Senior" not in allowed
    assert "Manager" not in allowed
    assert "Director+" not in allowed
    assert "Mid-level" not in allowed
    assert "Intern/Student" in allowed
    assert "Fresher/Entry level" in allowed


@pytest.mark.asyncio
async def test_manager_sql_rejects_intern_jobs():
    """Verify manager SQL would NOT match Intern/Fresher jobs."""
    captured = {}

    class FakeDB:
        async def execute(self, sql, params):
            captured.update(params)

            class R:
                def all(self):
                    return []

            return R()

    user = _UserProxy(
        id="00000000-0000-0000-0000-000000000005",
        skills=[],
        desired_titles=[],
        preferred_cities=[],
        desired_salary_min=None,
        experience_level="manager",
    )

    await find_matching_jobs(FakeDB(), user)

    allowed = captured["levels"]
    assert "Intern/Student" not in allowed
    assert "Fresher/Entry level" not in allowed
    assert "Mid-level" not in allowed
    assert "Senior" in allowed
    assert "Manager" in allowed
    assert "Director+" in allowed
