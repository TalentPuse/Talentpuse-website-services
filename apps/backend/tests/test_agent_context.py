"""AgentContext tolerates LangGraph/ag_ui_langgraph-injected context keys.

The AG-UI adapter merges config["configurable"] (thread_id + checkpointer keys)
into the context dict LangGraph coerces via AgentContext(**context). The schema
must ignore those extra keys and keep only `profile`.
"""
from app.services.agent.middleware.profile_injection import AgentContext


def test_legacy_profile_kwarg_still_works():
    ctx = AgentContext(profile={"full_name": "Minh"})
    assert ctx.profile == {"full_name": "Minh"}


def test_default_profile_is_empty_dict():
    assert AgentContext().profile == {}


def test_tolerates_agui_injected_keys():
    # thread_id + checkpointer keys are what ag_ui_langgraph injects.
    ctx = AgentContext(
        thread_id="room-123",
        checkpoint_ns="",
        checkpoint_id="1f0-abc",
    )
    assert ctx.profile == {}


def test_profile_and_injected_keys_together():
    ctx = AgentContext(profile={"skills": ["python"]}, thread_id="room-9")
    assert ctx.profile == {"skills": ["python"]}
