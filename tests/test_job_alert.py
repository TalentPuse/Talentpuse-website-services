"""Tests for job alert matching + dispatch."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

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
# format_job_message
# ─────────────────────────────────────────────

def test_format_single_job():
    jobs = [
        {
            "source_job_id": "123",
            "title": "AI Engineer",
            "company_name": "FPT",
            "city_canonical": "HCMC",
            "job_level": "Experienced",
            "salary_m": 30.0,
        }
    ]
    msg = format_job_message(jobs)
    assert "1 việc làm" in msg
    assert "AI Engineer" in msg
    assert "FPT" in msg
    assert "HCMC" in msg
    assert "30M" in msg
    assert "vietnamworks.com" in msg


def test_format_multiple_jobs():
    jobs = [
        {
            "source_job_id": "1",
            "title": "Data Engineer",
            "company_name": "VNG",
            "city_canonical": "HCMC",
            "job_level": "Senior",
            "salary_m": 25.0,
        },
        {
            "source_job_id": "2",
            "title": "AI Engineer",
            "company_name": "Grab",
            "city_canonical": "Hanoi",
            "job_level": "Mid",
            "salary_m": None,
        },
    ]
    msg = format_job_message(jobs)
    assert "2 việc làm" in msg
    assert "Data Engineer" in msg
    assert "AI Engineer" in msg


def test_format_no_salary():
    jobs = [
        {
            "source_job_id": "99",
            "title": "Backend Dev",
            "company_name": "Startup",
            "city_canonical": None,
            "job_level": None,
            "salary_m": None,
        }
    ]
    msg = format_job_message(jobs)
    assert "Backend Dev" in msg
    assert "VND" not in msg
