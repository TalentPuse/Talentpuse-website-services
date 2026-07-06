import pytest

from app.services.agent.tools.application_tools import (
    make_application_stats_tool, make_list_applications_tool,
)
from app.services import application_service as svc


@pytest.mark.asyncio
async def test_tools_return_user_data(db_session, seed_user, session_factory):
    await svc.create_application(db_session, seed_user.id, source="manual", title="AI Eng", status="interviewing")
    listed = await make_list_applications_tool(seed_user.id, session_factory).coroutine(status=None)
    stats = await make_application_stats_tool(seed_user.id, session_factory).coroutine()
    assert "AI Eng" in listed
    assert "interviewing" in stats
