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


class TestGetUserProfileTool:

    @pytest.mark.asyncio
    async def test_calls_mcp_with_correct_args(self):
        from app.services.agent.tools.skill_tools import get_user_profile

        with patch(
            "app.services.agent.tools.skill_tools.call_mcp_tool",
            AsyncMock(return_value="Skills: python, sql\nLevel: senior"),
        ) as mock_mcp:
            result = await get_user_profile.ainvoke({"user_id": "user-123"})

        mock_mcp.assert_called_once_with("get_user_profile", {"user_id": "user-123"})
        assert "python" in result

    @pytest.mark.asyncio
    async def test_user_not_found(self):
        from app.services.agent.tools.skill_tools import get_user_profile

        with patch(
            "app.services.agent.tools.skill_tools.call_mcp_tool",
            AsyncMock(return_value="User not found."),
        ):
            result = await get_user_profile.ainvoke({"user_id": "nonexistent"})

        assert "not found" in result
