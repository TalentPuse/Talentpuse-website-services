"""Pipeline extract hang ngay — chay gioi han, loi 1 job khong chan job khac."""
from unittest.mock import AsyncMock

from app.services.jd_extract import ExtractError
from app.services.jd_pipeline import run_extract_pipeline


def _fake_data():
    return {"summary": {"role_summary": "x", "seniority_hint": None},
            "skills": {"hard": [], "soft": [], "tools": [], "languages": [], "certifications": []},
            "requirements": {}, "responsibilities": [], "benefits": [], "keywords": [], "extras": []}


async def test_pipeline_extract_toi_da_limit(db_session, monkeypatch):
    fake_keys = [("topcv", f"job{i}") for i in range(5)]
    async def fake_missing_keys(db, limit=100):
        return fake_keys[:limit]
    monkeypatch.setattr(
        "app.services.jd_pipeline.get_missing_job_keys", fake_missing_keys
    )
    calls = []
    async def fake_extract(text, source=None, source_job_id=None):
        calls.append((text, source, source_job_id))
        return _fake_data()
    monkeypatch.setattr("app.services.jd_pipeline.extract_insight", fake_extract)
    monkeypatch.setattr("app.services.jd_pipeline.get_jd_text", AsyncMock(return_value="text"))

    n = await run_extract_pipeline(db_session, limit=3)
    assert n == 3
    assert len(calls) == 3
    for _, source, sjid in calls:
        assert source == "topcv"
        assert sjid is not None


async def test_pipeline_loi_mot_job_van_tiep_tuc(db_session, monkeypatch):
    fake_keys = [("topcv", "a"), ("topcv", "b")]
    monkeypatch.setattr("app.services.jd_pipeline.get_missing_job_keys", AsyncMock(return_value=fake_keys))
    calls = []
    async def fake_extract(text, source=None, source_job_id=None):
        calls.append(text)
        if text == "bad":
            raise ExtractError("x")
        return _fake_data()
    monkeypatch.setattr("app.services.jd_pipeline.extract_insight", fake_extract)
    async def fake_get_text(db, source, sjid):
        return "bad" if sjid == "a" else "ok"
    monkeypatch.setattr("app.services.jd_pipeline.get_jd_text", fake_get_text)

    n = await run_extract_pipeline(db_session, limit=2)
    assert n == 1  # chi job "b" thanh cong


async def test_pipeline_jd_text_trong_thi_bo_qua(db_session, monkeypatch):
    fake_keys = [("topcv", "empty"), ("topcv", "ok")]
    monkeypatch.setattr("app.services.jd_pipeline.get_missing_job_keys", AsyncMock(return_value=fake_keys))
    async def fake_extract(text, source=None, source_job_id=None):
        return _fake_data()
    monkeypatch.setattr("app.services.jd_pipeline.extract_insight", fake_extract)
    async def fake_get_text(db, source, sjid):
        return "" if sjid == "empty" else "ok"
    monkeypatch.setattr("app.services.jd_pipeline.get_jd_text", fake_get_text)

    n = await run_extract_pipeline(db_session, limit=2)
    assert n == 1


async def test_pipeline_loi_db_generic_khong_chan_ca_lo(db_session, monkeypatch):
    """Loi DB that (upsert fail: source qua dai VARCHAR(50)) o job dau abort
    transaction — job sau phai van chay.

    Job "a" source 60 ky tu -> real upsert_insight StringDataRightTruncationError
    -> transaction bi abort. Neu khong rollback, job "b" chet theo
    InFailedSQLTransactionError -> ca lo fail.
    """
    fake_keys = [("x" * 60, "a"), ("topcv", "b")]
    monkeypatch.setattr("app.services.jd_pipeline.get_missing_job_keys", AsyncMock(return_value=fake_keys))
    async def fake_extract(text, source=None, source_job_id=None):
        return _fake_data()
    monkeypatch.setattr("app.services.jd_pipeline.extract_insight", fake_extract)
    monkeypatch.setattr("app.services.jd_pipeline.get_jd_text", AsyncMock(return_value="text"))

    n = await run_extract_pipeline(db_session, limit=2)
    assert n == 1  # chi job "b" thanh cong sau khi rollback session
