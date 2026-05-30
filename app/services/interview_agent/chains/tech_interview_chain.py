"""Technical Interview Agent Chain.

Creates LangChain agent for technical interview conversations.
Follows exact pattern from app.services.agent
"""

from langchain.agents import create_agent

from app.services.agent.middleware import AgentContext, inject_user_profile
from app.services.interview_agent.prompts.tech_prompts import TECH_INTERVIEWER_SYSTEM
from app.services.agent.services.llm import create_llm

# Singleton agent instance
_tech_agent = None


def get_tech_interview_agent():
    """Get technical interview agent.

    Returns:
        LangChain agent configured for technical interviews
    """
    global _tech_agent
    if _tech_agent is not None:
        return _tech_agent

    llm = create_llm()

    # Use same pattern as skill_advisor_chain
    _tech_agent = create_agent(
        model=llm,
        tools=[],  # Interview doesn't need tools, just conversation
        prompt=TECH_INTERVIEWER_SYSTEM,
        middleware=[inject_user_profile],
        context_schema=AgentContext,
    )
    return _tech_agent


def reset_tech_agent():
    """Reset technical interview agent singleton."""
    global _tech_agent
    _tech_agent = None
