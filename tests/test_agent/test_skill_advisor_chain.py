"""Tests for skill advisor chain."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest


class TestGetAgent:

    def test_get_agent_singleton(self):
        import app.services.agent.chains.skill_advisor_chain as mod

        mod._agent = None

        mock_llm = MagicMock()
        mock_agent = MagicMock()

        with patch("app.services.agent.chains.skill_advisor_chain.create_llm", return_value=mock_llm), \
             patch("app.services.agent.chains.skill_advisor_chain.create_agent", return_value=mock_agent):
            agent1 = mod.get_agent()
            agent2 = mod.get_agent()

        assert agent1 is agent2
        assert agent1 is mock_agent

        mod._agent = None

    def test_reset_agent(self):
        import app.services.agent.chains.skill_advisor_chain as mod

        mod._agent = MagicMock()
        mod.reset_agent()
        assert mod._agent is None

    def test_agent_has_tools(self):
        import app.services.agent.chains.skill_advisor_chain as mod

        mod._agent = None

        mock_llm = MagicMock()

        with patch("app.services.agent.chains.skill_advisor_chain.create_llm", return_value=mock_llm), \
             patch("app.services.agent.chains.skill_advisor_chain.create_agent") as mock_create:
            mod.get_agent()

        call_kwargs = mock_create.call_args
        tools = call_kwargs.kwargs.get("tools", call_kwargs[1].get("tools", []))
        tool_names = [t.name for t in tools]
        assert "query_skill_gap" in tool_names
        assert "get_user_profile" in tool_names

        mod._agent = None
