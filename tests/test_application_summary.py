import pytest

from app.services import application_summary as sm
from app.services import application_service as svc


@pytest.mark.asyncio
async def test_empty_returns_invite_without_llm(db_session, seed_user, monkeypatch):
    def _boom():
        raise AssertionError("LLM must not be called")
    monkeypatch.setattr(sm, "_get_llm", _boom)
    out = await sm.build_summary(db_session, seed_user.id)
    assert "chưa" in out["summary_md"].lower()


@pytest.mark.asyncio
async def test_summary_calls_llm_when_data(db_session, seed_user, monkeypatch):
    await svc.create_application(db_session, seed_user.id, source="manual", title="Data Eng", company_name="Acme")

    class FakeMsg:
        content = "Bạn đã apply 1 job."

    class FakeLLM:
        async def ainvoke(self, messages):
            return FakeMsg()

    monkeypatch.setattr(sm, "_get_llm", lambda: FakeLLM())
    out = await sm.build_summary(db_session, seed_user.id)
    assert out["summary_md"] == "Bạn đã apply 1 job." and out["generated_at"] is not None
