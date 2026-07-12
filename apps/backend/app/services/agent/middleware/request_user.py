"""Request-scoped user profile cho AG-UI runs.

Legacy chat (api/chat.py) truyền AgentContext per-invoke. Endpoint AG-UI
không kiểm soát invoke (ag_ui_langgraph gọi graph), nên middleware auth của
sub-app (api/agui.py) stash profile vào ContextVar, và before_model này
inject — mirror inject_user_profile. Khi runtime.context đã có profile
(đường legacy) thì middleware này nhường, tránh inject đôi.
"""
from __future__ import annotations

from contextvars import ContextVar

from langchain.agents.middleware import Runtime, before_model
from langchain_core.messages import SystemMessage

from app.services.agent.middleware.profile_injection import (
    PROFILE_MESSAGE_ID,
    _format_profile,
)

current_agent_profile: ContextVar[dict | None] = ContextVar(
    "current_agent_profile", default=None
)


def _inject(state, runtime: Runtime):
    if runtime.context is not None and getattr(runtime.context, "profile", None):
        return None  # legacy path đã inject
    profile = current_agent_profile.get()
    if not profile:
        return None
    return {
        "messages": [
            SystemMessage(content=_format_profile(profile), id=PROFILE_MESSAGE_ID),
        ]
    }


inject_request_user = before_model(_inject)
