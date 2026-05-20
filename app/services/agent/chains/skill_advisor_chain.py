"""Skill Advisor Chain — wire LLM + tools + prompt into agent."""

from langchain.agents import create_agent

from app.services.agent.prompts.skill_advisor_prompt import SYSTEM_PROMPT
from app.services.agent.services.llm import create_llm
from app.services.agent.tools.skill_tools import query_skill_gap, get_user_profile

_agent = None


def get_agent():
    global _agent
    if _agent is not None:
        return _agent

    llm = create_llm()
    _agent = create_agent(
        model=llm,
        tools=[query_skill_gap, get_user_profile],
        system_prompt=SYSTEM_PROMPT,
    )
    return _agent


def reset_agent():
    global _agent
    _agent = None
