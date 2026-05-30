"""Behavioral Interview Agent Chain.

Creates LangChain agent for behavioral interview conversations.
Follows exact pattern from app.services.agent
"""

from langchain.agents import create_agent

from app.services.agent.middleware import AgentContext, inject_user_profile
from app.services.interview_agent.prompts.behavioral_prompts import BEHAVIORAL_INTERVIEWER_SYSTEM
from app.services.agent.services.llm import create_llm

# Singleton agent instance
_behavioral_agent = None


def get_behavioral_interview_agent():
    """Get behavioral interview agent.

    Returns:
        LangChain agent configured for behavioral interviews
    """
    global _behavioral_agent
    if _behavioral_agent is not None:
        return _behavioral_agent

    llm = create_llm()

    # Use same pattern as skill_advisor_chain
    _behavioral_agent = create_agent(
        model=llm,
        tools=[],  # Interview doesn't need tools, just conversation
        prompt=BEHAVIORAL_INTERVIEWER_SYSTEM,
        middleware=[inject_user_profile],
        context_schema=AgentContext,
    )
    return _behavioral_agent


def reset_behavioral_agent():
    """Reset behavioral interview agent singleton."""
    global _behavioral_agent
    _behavioral_agent = None
