"""Tests for search_jobs_realtime MCP tool."""
from __future__ import annotations

import asyncio
from unittest.mock import patch

import pandas as pd
import pytest

from mcp_server.services.jobspy_service import _map_row_to_result, search_jobs


def _make_df(rows: list[dict]) -> pd.DataFrame:
    defaults = {
        "title": "Data Engineer",
        "company": "Test Corp",
        "location": "Ho Chi Minh City",
        "job_url": "https://example.com/job/1",
        "job_url_direct": None,
        "date_posted": "2026-05-20",
        "job_type": "Full-time",
        "job_level": "Mid",
        "is_remote": False,
        "description": "Test description",
        "site": "linkedin",
        "min_amount": None,
        "max_amount": None,
        "currency": None,
        "interval": None,
        "skills": None,
        "company_industry": None,
    }
    for row in rows:
        for k, v in defaults.items():
            row.setdefault(k, v)
    return pd.DataFrame(rows)


@pytest.mark.asyncio
async def test_search_jobs_returns_results():
    mock_df = _make_df([
        {"title": "AI Engineer", "company": "VNG", "job_url": "https://li.com/1", "site": "linkedin"},
        {"title": "Data Scientist", "company": "FPT", "job_url": "https://indeed.com/2", "site": "indeed"},
    ])

    with patch("mcp_server.services.jobspy_service.scrape_jobs", return_value=mock_df):
        result = await search_jobs(query="AI Engineer", location="Ho Chi Minh City")

    assert result.success is True
    assert result.total_found == 2
    assert len(result.jobs) == 2
    assert result.jobs[0].title == "AI Engineer"
    assert result.jobs[0].employer == "VNG"


@pytest.mark.asyncio
async def test_search_jobs_empty_results():
    empty_df = pd.DataFrame()
    with patch("mcp_server.services.jobspy_service.scrape_jobs", return_value=empty_df):
        result = await search_jobs(query="Nonexistent Job")

    assert result.success is True
    assert result.total_found == 0
    assert result.jobs == []


@pytest.mark.asyncio
async def test_search_jobs_deduplication():
    mock_df = _make_df([
        {"job_url": "https://same.com/1", "title": "Job A"},
        {"job_url": "https://same.com/1", "title": "Job A Duplicate"},
    ])
    with patch("mcp_server.services.jobspy_service.scrape_jobs", return_value=mock_df):
        result = await search_jobs(query="Test")

    assert result.total_found == 1


@pytest.mark.asyncio
async def test_search_jobs_timeout():
    def slow_scrape(**kwargs):
        import time
        time.sleep(10)
        return pd.DataFrame()

    with patch("mcp_server.services.jobspy_service.scrape_jobs", side_effect=slow_scrape):
        result = await search_jobs(query="Test", timeout=1)

    assert result.success is False
    assert result.source_errors
    assert "timed out" in result.source_errors[0].lower()


@pytest.mark.asyncio
async def test_search_jobs_source_error_graceful():
    def fail_scrape(**kwargs):
        raise RuntimeError("LinkedIn blocked")

    with patch("mcp_server.services.jobspy_service.scrape_jobs", side_effect=fail_scrape):
        result = await search_jobs(query="Test", sources=["linkedin", "indeed"])

    assert result.success is False


def test_map_row_salary_formatting():
    row = pd.Series({
        "title": "Engineer",
        "company": "Test",
        "job_url": "https://x.com/1",
        "location": "HCM",
        "site": "indeed",
        "min_amount": 20000000,
        "max_amount": 35000000,
        "currency": "VND",
        "interval": "monthly",
    })
    result = _map_row_to_result(row)
    assert "VND" in result.salary
    assert "20000000" in result.salary
