"""Tool applications đọc user từ ContextVar, không còn closure factory."""
import json
import uuid

import pytest

from app.services import application_service as svc
from app.services.agent.context import current_agent_user_id
from app.services.agent.tools.application_tools import (
    get_application_stats,
    list_my_applications,
)


@pytest.fixture
def as_user():
    """Set/reset current_agent_user_id quanh mỗi test.

    pytest-asyncio chạy thân test (async def) trong một asyncio.Task riêng —
    Task đó nhận một BẢN SAO của Context hiện tại. Token trả về từ `.set()`
    gọi bên trong Task đó gắn với Context của Task, không phải Context gốc nơi
    generator fixture này chạy phần teardown (sau `yield`) — nên `.reset(token)`
    ở đây ném `ValueError: ... created in a different Context`. Việc set trong
    Task con vốn đã không rò rỉ ra Context cha, nên bỏ qua lỗi này là an toàn.
    """
    tokens = []

    def _set(uid):
        tokens.append(current_agent_user_id.set(uid))

    yield _set
    for t in reversed(tokens):
        try:
            current_agent_user_id.reset(t)
        except ValueError:
            pass


@pytest.mark.asyncio
async def test_tools_return_user_data(db_session, seed_user, as_user):
    await svc.create_application(
        db_session, seed_user.id, source="manual", title="AI Eng", status="interviewing"
    )
    as_user(seed_user.id)

    listed = await list_my_applications.coroutine(status=None)
    stats = json.loads(await get_application_stats.coroutine())

    assert "AI Eng" in listed
    assert stats["by_status"]["interviewing"] == 1
    assert stats["total"] == 1


@pytest.mark.asyncio
async def test_tools_scoped_to_user(db_session, seed_user, as_user):
    await svc.create_application(
        db_session, seed_user.id, source="manual", title="Mine", status="applied"
    )
    as_user(uuid.uuid4())  # user khác

    listed = await list_my_applications.coroutine(status=None)
    stats = json.loads(await get_application_stats.coroutine())

    assert "Mine" not in listed
    assert stats["total"] == 0


@pytest.mark.asyncio
async def test_list_includes_id_and_source_url(db_session, seed_user, as_user, monkeypatch):
    """Đợt 2 (widget ApplicationTracker) cần id để PATCH status + link JD.

    source_job_id khác None đi qua nhánh "internal" của create_application,
    nhánh này snapshot job thật từ warehouse (dbt_dev_gold.fct_jobs_daily).
    "abc123" không tồn tại trong warehouse thật nên phải fake snapshot_job —
    cùng pattern với test_application_service.py::test_create_internal_is_idempotent.
    """
    async def fake_snapshot(db, source, source_job_id):
        return {
            "title": "Data Engineer", "company_name": "Shopee", "city": "HCM",
            "source_url": "https://linkedin.com/jobs/1", "salary_million": None,
        }
    monkeypatch.setattr(svc, "snapshot_job", fake_snapshot)

    await svc.create_application(
        db_session, seed_user.id, source="linkedin", source_job_id="abc123",
        status="applied",
    )
    as_user(seed_user.id)

    rows = json.loads(await list_my_applications.coroutine(status=None))

    assert len(rows) == 1
    assert rows[0]["id"]
    assert rows[0]["source_url"] == "https://linkedin.com/jobs/1"
    assert rows[0]["company"] == "Shopee"


@pytest.mark.asyncio
async def test_tool_without_user_context_returns_friendly_error(as_user):
    as_user(None)
    out = await list_my_applications.coroutine(status=None)
    assert out.startswith("Loi")
