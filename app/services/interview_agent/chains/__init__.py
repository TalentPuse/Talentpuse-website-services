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

# Singleton agent instance (cached after first call)
_interview_agent = None


def get_interview_agent(mode: str = "behavioral"):
    """Get interview agent by mode.

    Args:
        mode: "technical" or "behavioral"

    Returns:
        LangChain agent for interview conversations
    """
    global _interview_agent
    if _interview_agent is not None:
        return _interview_agent

    if mode == "technical":
        _interview_agent = get_tech_interview_agent()
    else:
        _interview_agent = get_behavioral_interview_agent()

    return _interview_agent


def reset_interview_agent():
    """Reset interview agent singleton."""
    global _interview_agent
    _interview_agent = None
    reset_tech_agent()
    reset_behavioral_agent()


__all__ = [
    "get_tech_interview_agent",
    "get_behavioral_interview_agent",
    "get_interview_agent",
    "reset_interview_agent",
]



