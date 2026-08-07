"""Repo jd_insight — upsert idempotent + tim job chua extract."""
from sqlalchemy import text

from app.services.jd_insight_repo import get_insight, get_missing_job_keys, upsert_insight


async def test_upsert_then_read_back(db_session):
    data = {"summary": {"role_summary": "x", "seniority_hint": None}, "skills": {"hard": ["python"], "soft": [],
            "tools": [], "languages": [], "certifications": []}, "requirements": {}, "responsibilities": [],
            "benefits": [], "keywords": [], "extras": []}
    await upsert_insight(db_session, "topcv", "1", data, "jdi-v1")
    got = await get_insight(db_session, "topcv", "1")
    assert got is not None and got["skills"]["hard"] == ["python"]


async def test_upsert_twice_ghi_de_khong_loi(db_session):
    data = {"summary": {"role_summary": "a", "seniority_hint": None}, "skills": {"hard": ["a"], "soft": [],
            "tools": [], "languages": [], "certifications": []}, "requirements": {}, "responsibilities": [],
            "benefits": [], "keywords": [], "extras": []}
    await upsert_insight(db_session, "topcv", "1", data, "jdi-v1")
    data["skills"]["hard"] = ["b"]
    await upsert_insight(db_session, "topcv", "1", data, "jdi-v1")
    got = await get_insight(db_session, "topcv", "1")
    assert got["skills"]["hard"] == ["b"]


async def test_get_missing_chi_tra_job_chua_extract(db_session):
    # Seed 2 job vao dbt_dev_silver.silver_job_detail (fake) + 1 da co insight
    await db_session.execute(text("CREATE SCHEMA IF NOT EXISTS dbt_dev_silver"))
    await db_session.execute(text("""
        CREATE TABLE IF NOT EXISTS dbt_dev_silver.silver_job_detail (
            source varchar, source_job_id varchar,
            job_description_text text, job_requirement_text text
        )
    """))
    # Bang co the da ton tai tu test khac (test_alert_click tao bang 3 cot),
    # nen chi them cot thieu, khong pha bang cu.
    await db_session.execute(text("""
        ALTER TABLE dbt_dev_silver.silver_job_detail
            ADD COLUMN IF NOT EXISTS job_description_text text,
            ADD COLUMN IF NOT EXISTS job_requirement_text text
    """))
    await db_session.execute(text(
        "INSERT INTO dbt_dev_silver.silver_job_detail "
        "(source, source_job_id, job_description_text, job_requirement_text) VALUES "
        f"('topcv','a','{'x' * 200}','req'), ('topcv','b','{'x' * 200}','req')"
    ))
    await db_session.commit()

    data = {"summary": {"role_summary": "x", "seniority_hint": None}, "skills": {"hard": [], "soft": [],
            "tools": [], "languages": [], "certifications": []}, "requirements": {}, "responsibilities": [],
            "benefits": [], "keywords": [], "extras": []}
    await upsert_insight(db_session, "topcv", "a", data, "jdi-v1")

    keys = await get_missing_job_keys(db_session, limit=10)
    assert ("topcv", "b") in keys
    assert ("topcv", "a") not in keys
