"""Unit tests for interview agent chains.

Tests that agents follow the exact pattern from app.services.agent
"""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


class TestTechInterviewAgent:
    """Test technical interview agent chain."""

    def test_get_tech_interview_agent_singleton(self):
        """Test that get_tech_interview_agent returns singleton."""
        import app.services.interview_agent.chains.tech_interview_chain as mod

        mod._tech_agent = None

        mock_llm = MagicMock()
        mock_agent = MagicMock()

        with patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_agent",
            return_value=mock_agent,
        ):
            agent1 = mod.get_tech_interview_agent()
            agent2 = mod.get_tech_interview_agent()

        assert agent1 is agent2
        assert agent1 is mock_agent

        mod._tech_agent = None

    def test_reset_tech_agent(self):
        """Test that reset_tech_agent clears singleton."""
        import app.services.interview_agent.chains.tech_interview_chain as mod

        mod._tech_agent = MagicMock()
        mod.reset_tech_agent()
        assert mod._tech_agent is None

    def test_tech_agent_uses_create_agent(self):
        """Test that tech agent uses create_agent from langchain.agents."""
        import app.services.interview_agent.chains.tech_interview_chain as mod

        mod._tech_agent = None

        mock_llm = MagicMock()

        with patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_agent"
        ) as mock_create:
            mod.get_tech_interview_agent()

            # Verify create_agent was called
            assert mock_create.called
            call_kwargs = mock_create.call_args.kwargs
            assert "model" in call_kwargs
            assert "prompt" in call_kwargs
            assert "middleware" in call_kwargs
            assert "context_schema" in call_kwargs

        mod._tech_agent = None

    def test_tech_agent_has_empty_tools(self):
        """Test that tech agent has no tools (interview is conversational)."""
        import app.services.interview_agent.chains.tech_interview_chain as mod

        mod._tech_agent = None

        mock_llm = MagicMock()

        with patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_agent"
        ) as mock_create:
            mod.get_tech_interview_agent()

            call_kwargs = mock_create.call_args.kwargs
            tools = call_kwargs.get("tools", [])
            assert tools == []

        mod._tech_agent = None


class TestBehavioralInterviewAgent:
    """Test behavioral interview agent chain."""

    def test_get_behavioral_interview_agent_singleton(self):
        """Test that get_behavioral_interview_agent returns singleton."""
        import app.services.interview_agent.chains.behavioral_interview_chain as mod

        mod._behavioral_agent = None

        mock_llm = MagicMock()
        mock_agent = MagicMock()

        with patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_agent",
            return_value=mock_agent,
        ):
            agent1 = mod.get_behavioral_interview_agent()
            agent2 = mod.get_behavioral_interview_agent()

        assert agent1 is agent2
        assert agent1 is mock_agent

        mod._behavioral_agent = None

    def test_reset_behavioral_agent(self):
        """Test that reset_behavioral_agent clears singleton."""
        import app.services.interview_agent.chains.behavioral_interview_chain as mod

        mod._behavioral_agent = MagicMock()
        mod.reset_behavioral_agent()
        assert mod._behavioral_agent is None

    def test_behavioral_agent_uses_create_agent(self):
        """Test that behavioral agent uses create_agent from langchain.agents."""
        import app.services.interview_agent.chains.behavioral_interview_chain as mod

        mod._behavioral_agent = None

        mock_llm = MagicMock()

        with patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_agent"
        ) as mock_create:
            mod.get_behavioral_interview_agent()

            # Verify create_agent was called
            assert mock_create.called
            call_kwargs = mock_create.call_args.kwargs
            assert "model" in call_kwargs
            assert "prompt" in call_kwargs
            assert "middleware" in call_kwargs
            assert "context_schema" in call_kwargs

        mod._behavioral_agent = None

    def test_behavioral_agent_has_empty_tools(self):
        """Test that behavioral agent has no tools (interview is conversational)."""
        import app.services.interview_agent.chains.behavioral_interview_chain as mod

        mod._behavioral_agent = None

        mock_llm = MagicMock()

        with patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_agent"
        ) as mock_create:
            mod.get_behavioral_interview_agent()

            call_kwargs = mock_create.call_args.kwargs
            tools = call_kwargs.get("tools", [])
            assert tools == []

        mod._behavioral_agent = None


class TestInterviewAgentFactory:
    """Test interview agent factory function."""

    def test_get_interview_agent_technical(self):
        """Test get_interview_agent with mode='technical'."""
        from app.services.interview_agent.chains import get_interview_agent

        # Reset singleton
        import app.services.interview_agent.chains as mod
        mod._interview_agent = None
        mod._tech_agent = None
        mod._behavioral_agent = None

        mock_llm = MagicMock()
        mock_agent = MagicMock()

        with patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.tech_interview_chain.create_agent",
            return_value=mock_agent,
        ):
            agent = get_interview_agent(mode="technical")
            assert agent is mock_agent

        # Cleanup
        mod._interview_agent = None
        mod._tech_agent = None

    def test_get_interview_agent_behavioral(self):
        """Test get_interview_agent with mode='behavioral'."""
        from app.services.interview_agent.chains import get_interview_agent

        # Reset singleton
        import app.services.interview_agent.chains as mod
        mod._interview_agent = None
        mod._tech_agent = None
        mod._behavioral_agent = None

        mock_llm = MagicMock()
        mock_agent = MagicMock()

        with patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_agent",
            return_value=mock_agent,
        ):
            agent = get_interview_agent(mode="behavioral")
            assert agent is mock_agent

        # Cleanup
        mod._interview_agent = None
        mod._behavioral_agent = None

    def test_get_interview_agent_singleton(self):
        """Test that get_interview_agent returns singleton across calls."""
        from app.services.interview_agent.chains import get_interview_agent

        # Reset singleton
        import app.services.interview_agent.chains as mod
        mod._interview_agent = None
        mod._tech_agent = None
        mod._behavioral_agent = None

        mock_llm = MagicMock()
        mock_agent = MagicMock()

        with patch(
            "app.services.interview_agent.chains.behavioral_interview_chain.create_llm",
            return_value=mock_llm,
        ), patch(
            "app.services.interview_agent.chains.behavioral_interview_channel.create_agent",
            return_value=mock_agent,
        ):
            agent1 = get_interview_agent(mode="behavioral")
            agent2 = get_interview_agent(mode="technical")  # Should return same singleton

        # Both calls should return the same singleton instance
        assert agent1 is agent2

        # Cleanup
        mod._interview_agent = None
        mod._behavioral_agent = None

    def test_reset_interview_agent(self):
        """Test that reset_interview_agent clears all singletons."""
        from app.services.interview_agent.chains import reset_interview_agent

        import app.services.interview_agent.chains as mod
        mod._interview_agent = MagicMock()
        mod._tech_agent = MagicMock()
        mod._behavioral_agent = MagicMock()

        reset_interview_agent()

        assert mod._interview_agent is None
        assert mod._tech_agent is None
        assert mod._behavioral_agent is None
