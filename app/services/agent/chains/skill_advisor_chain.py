"""Skill Advisor Chain — wire LLM + tools + prompt + middleware into agent."""

from langchain.agents import create_agent

from app.services.agent.middleware import AgentContext, inject_user_profile
from app.services.agent.middleware.request_user import inject_request_user
from app.services.agent.prompts.skill_advisor_prompt import SYSTEM_PROMPT
from app.services.agent.services.llm import create_llm
from app.services.agent.tools.application_tools import (
    get_application_stats,
    list_my_applications,
)
from app.services.agent.tools.cv_coach_tool import get_cv_writing_guide
from app.services.agent.tools.cv_edit_tool import edit_cv
from app.services.agent.tools.job_search_tools import search_jobs_realtime
from app.services.agent.tools.skill_tools import query_skill_gap

_BASE_TOOLS = [
    query_skill_gap,
    get_cv_writing_guide,
    search_jobs_realtime,
    list_my_applications,
    get_application_stats,
    edit_cv,
]
_agent = None
_llm = None


def _get_llm():
    # Reuse one ChatOpenAI client across requests — request-scoped agents
    # (built per chat message to bind the edit_cv tool) shouldn't re-create it.
    global _llm
    if _llm is None:
        _llm = create_llm()
    return _llm


def build_agent(extra_tools=(), checkpointer=None, extra_middleware=()):
    """Construct a fresh agent. Pass extra_tools (e.g. a per-user edit_cv tool)
    for request-scoped agents; the no-arg cached singleton uses base tools only.
    checkpointer bật LangGraph persistence cho đường AG-UI (threadId = room id);
    extra_middleware cho AG-UI path (CopilotKitMiddleware); legacy giữ mặc định."""
    return create_agent(
        model=_get_llm(),
        tools=[*_BASE_TOOLS, *extra_tools],
        system_prompt=SYSTEM_PROMPT,
        middleware=[inject_user_profile, inject_request_user, *extra_middleware],
        context_schema=AgentContext,
        checkpointer=checkpointer,
    )


def get_agent():
    global _agent
    if _agent is None:
        _agent = build_agent()
    return _agent


def reset_agent():
    global _agent
    _agent = None
