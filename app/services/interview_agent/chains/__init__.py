"""LangChain agent wiring for interview conversations.

This module creates LangChain agents for different interview modes.
Follows exact pattern from app.services.agent
"""

from app.services.interview_agent.chains.behavioral_interview_chain import (
    get_behavioral_interview_agent,
    reset_behavioral_agent,
)
from app.services.interview_agent.chains.tech_interview_chain import (
    get_tech_interview_agent,
    reset_tech_agent,
)

# Separate singletons per mode
_tech_agent = None
_behavioral_agent = None


def get_interview_agent(mode: str = "behavioral"):
    """Get interview agent by mode.

    Args:
        mode: "technical" or "behavioral"

    Returns:
        LangChain agent for interview conversations
    """
    if mode == "technical":
        return get_tech_interview_agent()
    else:
        return get_behavioral_interview_agent()


def reset_interview_agent():
    """Reset all interview agent singletons."""
    reset_tech_agent()
    reset_behavioral_agent()


__all__ = [
    "get_tech_interview_agent",
    "get_behavioral_interview_agent",
    "get_interview_agent",
    "reset_interview_agent",
]
