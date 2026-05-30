"""Tests for LangChain tools (skill_tools)."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest


class TestQuerySkillGapTool:

    @pytest.mark.asyncio
    async def test_calls_mcp_with_correct_args(self):
        from app.services.agent.tools.skill_tools import query_skill_gap

        with patch(
            "app.services.agent.tools.skill_tools.call_mcp_tool",
            AsyncMock(return_value="- pytorch (ai_ml): 45 jobs"),
        ) as mock_mcp:
            result = await query_skill_gap.ainvoke({"user_skills": "python,sql"})

        mock_mcp.assert_called_once_with(
            "query_skill_gap", {"user_skills": "python,sql"}
        )
        assert "pytorch" in result

    @pytest.mark.asyncio
    async def test_empty_input(self):
        from app.services.agent.tools.skill_tools import query_skill_gap

        with patch(
            "app.services.agent.tools.skill_tools.call_mcp_tool",
            AsyncMock(return_value="Please provide your skills"),
        ) as mock_mcp:
            result = await query_skill_gap.ainvoke({"user_skills": ""})

        assert "Please provide" in result


