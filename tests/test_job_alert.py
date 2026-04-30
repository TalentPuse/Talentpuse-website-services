"""Tests for job alert matching + dispatch."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app
from app.services.job_alert import format_job_message


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
            "job_level": "Experienced (non-manager)",
            "job_category": "Data Analyst",
            "salary_m": 25.0,
            "score": 80.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "📊 Experienced (non-manager)" in msg
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
