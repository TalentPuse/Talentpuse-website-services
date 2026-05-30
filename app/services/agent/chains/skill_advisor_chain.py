"""Skill Advisor Chain — wire LLM + tools + prompt + middleware into agent."""

from langchain.agents import create_agent

from app.services.agent.middleware import AgentContext, inject_user_profile
from app.services.agent.prompts.skill_advisor_prompt import SYSTEM_PROMPT
from app.services.agent.services.llm import create_llm
from app.services.agent.tools.cv_coach_tool import get_cv_writing_guide
from app.services.agent.tools.job_search_tools import search_jobs_realtime
from app.services.agent.tools.skill_tools import query_skill_gap

_agent = None


def get_agent():
    global _agent
    if _agent is not None:
        return _agent

    llm = create_llm()
    _agent = create_agent(
        model=llm,
        tools=[query_skill_gap, get_cv_writing_guide, search_jobs_realtime],
        system_prompt=SYSTEM_PROMPT,
        middleware=[inject_user_profile],
        context_schema=AgentContext,
    )
    return _agent


def reset_agent():
    global _agent
    _agent = None
