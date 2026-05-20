"""Tests for MCP client wrapper."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class TestCallMcpTool:

    @pytest.mark.asyncio
    async def test_call_tool_success(self):
        from app.services.agent.services.mcp_client import call_mcp_tool

        mock_text = MagicMock()
        mock_text.text = "pytorch: 45 jobs, 28.0M VND"

        mock_client = AsyncMock()
        mock_client.call_tool = AsyncMock(return_value=[mock_text])

        with patch(
            "app.services.agent.services.mcp_client.get_mcp_client",
            AsyncMock(return_value=mock_client),
        ):
            result = await call_mcp_tool("query_skill_gap", {"user_skills": "python"})

        assert "pytorch" in result
        mock_client.call_tool.assert_called_once_with(
            "query_skill_gap", {"user_skills": "python"}
        )

    @pytest.mark.asyncio
    async def test_call_tool_empty_result(self):
        from app.services.agent.services.mcp_client import call_mcp_tool

        mock_client = AsyncMock()
        mock_client.call_tool = AsyncMock(return_value=[])

        with patch(
            "app.services.agent.services.mcp_client.get_mcp_client",
            AsyncMock(return_value=mock_client),
        ):
            result = await call_mcp_tool("get_user_profile", {"user_id": "x"})

        assert result == ""

    @pytest.mark.asyncio
    async def test_close_client(self):
        import app.services.agent.services.mcp_client as mod

        mock_client = AsyncMock()
        mod._client = mock_client

        await mod.close_mcp_client()

        mock_client.close.assert_called_once()
        assert mod._client is None
