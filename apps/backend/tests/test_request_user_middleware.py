"""inject_request_user: đọc profile từ ContextVar, nhường legacy AgentContext."""
from types import SimpleNamespace

from app.services.agent.middleware.request_user import (
    _inject,
    current_agent_profile,
)


def _runtime(context=None):
    return SimpleNamespace(context=context)


def test_no_profile_no_injection():
    token = current_agent_profile.set(None)
    try:
        assert _inject({}, _runtime()) is None
    finally:
        current_agent_profile.reset(token)


def test_injects_profile_from_contextvar():
    token = current_agent_profile.set({"full_name": "Minh", "skills": ["python"]})
    try:
        result = _inject({}, _runtime())
        assert result is not None
        msg = result["messages"][0]
        assert "Minh" in msg.content
        assert msg.id == "__user_profile__"
    finally:
        current_agent_profile.reset(token)


def test_legacy_agent_context_wins():
    token = current_agent_profile.set({"full_name": "Minh"})
    try:
        legacy = SimpleNamespace(profile={"full_name": "Legacy"})
        assert _inject({}, _runtime(legacy)) is None
    finally:
        current_agent_profile.reset(token)
