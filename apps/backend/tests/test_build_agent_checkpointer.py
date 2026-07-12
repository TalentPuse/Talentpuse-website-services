"""build_agent nhận checkpointer (AG-UI path) và mặc định None (legacy)."""
import pytest
from langgraph.checkpoint.memory import MemorySaver


@pytest.fixture(autouse=True)
def _fake_key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    from app.services.agent.chains import skill_advisor_chain as chain

    chain._llm = None  # reset cache client
    yield
    chain._llm = None


def test_build_agent_accepts_checkpointer():
    from app.services.agent.chains.skill_advisor_chain import build_agent

    graph = build_agent(checkpointer=MemorySaver())
    assert graph is not None


def test_build_agent_default_no_checkpointer():
    from app.services.agent.chains.skill_advisor_chain import build_agent

    graph = build_agent()
    assert graph is not None
