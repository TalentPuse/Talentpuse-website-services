"""Tests for LangChain tools (market_tools)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


class TestSalaryBenchmarkTool:

    @pytest.mark.asyncio
    async def test_calls_mcp_with_correct_args(self):
        from app.services.agent.tools.market_tools import salary_benchmark

        with patch(
            "app.services.agent.tools.market_tools.call_mcp_tool",
            AsyncMock(return_value='[{"p25": 20, "p50": 30, "p75": 40}]'),
        ) as mock_mcp:
            result = await salary_benchmark.ainvoke(
                {
                    "job_category": "Backend Developer",
                    "job_level": "mid",
                    "city": "Ho Chi Minh",
                }
            )

        mock_mcp.assert_called_once_with(
            "get_salary_benchmark",
            {
                "job_category": "Backend Developer",
                "job_level": "mid",
                "city": "Ho Chi Minh",
            },
        )
        assert result == '[{"p25": 20, "p50": 30, "p75": 40}]'

    @pytest.mark.asyncio
    async def test_no_filters_passes_none(self):
        from app.services.agent.tools.market_tools import salary_benchmark

        with patch(
            "app.services.agent.tools.market_tools.call_mcp_tool",
            AsyncMock(return_value="[]"),
        ) as mock_mcp:
            result = await salary_benchmark.ainvoke({})

        mock_mcp.assert_called_once_with(
            "get_salary_benchmark",
            {"job_category": None, "job_level": None, "city": None},
        )
        assert result == "[]"

    @pytest.mark.asyncio
    async def test_returns_mcp_error_string_unchanged(self):
        from app.services.agent.tools.market_tools import salary_benchmark

        error_msg = "Loi: Khong the ket noi den MCP server de goi tool 'get_salary_benchmark'. Vui long thu lai sau hoac hoi khac."
        with patch(
            "app.services.agent.tools.market_tools.call_mcp_tool",
            AsyncMock(return_value=error_msg),
        ):
            result = await salary_benchmark.ainvoke({"job_category": "AI Engineer"})

        assert result == error_msg


class TestCompanyHiringTool:

    @pytest.mark.asyncio
    async def test_calls_mcp_with_correct_args(self):
        from app.services.agent.tools.market_tools import company_hiring

        with patch(
            "app.services.agent.tools.market_tools.call_mcp_tool",
            AsyncMock(return_value='[{"company_name": "FPT Software", "open_jobs": 12}]'),
        ) as mock_mcp:
            result = await company_hiring.ainvoke({"company": "FPT Software"})

        mock_mcp.assert_called_once_with(
            "get_company_hiring", {"company_name": "FPT Software"}
        )
        assert "FPT Software" in result

    @pytest.mark.asyncio
    async def test_no_match_returns_empty_list_unchanged(self):
        from app.services.agent.tools.market_tools import company_hiring

        with patch(
            "app.services.agent.tools.market_tools.call_mcp_tool",
            AsyncMock(return_value="[]"),
        ) as mock_mcp:
            result = await company_hiring.ainvoke({"company": "Nonexistent Corp"})

        mock_mcp.assert_called_once_with(
            "get_company_hiring", {"company_name": "Nonexistent Corp"}
        )
        assert result == "[]"
