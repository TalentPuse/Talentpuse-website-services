import datetime
import uuid

import pytest

from app.services import application_service as svc


@pytest.mark.asyncio
async def test_create_manual_defaults_applied_today(db_session, seed_user):
    app = await svc.create_application(db_session, seed_user.id, source="manual", title="Data Engineer", company_name="Acme")
    assert app.source == "manual" and app.source_job_id is None
    assert app.status == "applied" and app.applied_at == datetime.date.today()


@pytest.mark.asyncio
async def test_create_internal_is_idempotent(db_session, seed_user, monkeypatch):
    async def fake_snapshot(db, source, source_job_id):
        return {"title": "AI Eng", "company_name": "VNG", "city": "HCM", "source_url": "http://x", "salary_million": 40.0}
    monkeypatch.setattr(svc, "snapshot_job", fake_snapshot)
    a1 = await svc.create_application(db_session, seed_user.id, source="itviec", source_job_id="J1")
    a2 = await svc.create_application(db_session, seed_user.id, source="itviec", source_job_id="J1")
    assert a1.id == a2.id


@pytest.mark.asyncio
async def test_list_filter_and_stats(db_session, seed_user):
    await svc.create_application(db_session, seed_user.id, source="manual", title="A", status="applied")
    await svc.create_application(db_session, seed_user.id, source="manual", title="B", status="interviewing")
    assert len(await svc.list_applications(db_session, seed_user.id)) == 2
    only_iv = await svc.list_applications(db_session, seed_user.id, status="interviewing")
    assert len(only_iv) == 1 and only_iv[0].title == "B"
    stats = await svc.get_stats(db_session, seed_user.id)
    assert stats["total"] == 2 and stats["by_status"]["interviewing"] == 1 and stats["applied_this_week"] >= 1


@pytest.mark.asyncio
async def test_update_and_delete_scoped_to_user(db_session, seed_user):
    a = await svc.create_application(db_session, seed_user.id, source="manual", title="C")
    assert (await svc.update_application(db_session, seed_user.id, a.id, status="offer")).status == "offer"
    other = uuid.uuid4()
    assert await svc.update_application(db_session, other, a.id, status="rejected") is None
    assert await svc.delete_application(db_session, other, a.id) is False
    assert await svc.delete_application(db_session, seed_user.id, a.id) is True
