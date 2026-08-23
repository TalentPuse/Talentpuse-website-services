import pytest
from app.core.security import create_access_token


@pytest.mark.asyncio
async def test_health_requires_auth(client):
    resp = await client.get("/api/pro/health")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_health_for_pro_ok(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "total_jd" in data and "extracted" in data and "llm" in data


@pytest.mark.asyncio
async def test_health_free_forbidden(client, db_session, seed_user):
    seed_user.subscription_tier = "free"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_skills_top_pro(client, db_session, seed_user, admin_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/skills/top?limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


@pytest.mark.asyncio
async def test_skills_top_free_blocked(client, db_session, seed_user):
    seed_user.subscription_tier = "free"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/skills/top", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_tools_top_with_category(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/tools/top?category=AI&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_insight_404(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/jobs/unknown/999/insight", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_export_xlsx(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/export.xlsx?kind=skills&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert len(resp.content) > 500


@pytest.mark.asyncio
async def test_report(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.post("/api/pro/report?category=AI", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "narrative" in resp.json() and "tables" in resp.json()


@pytest.mark.asyncio
async def test_health_gap_days(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert "gap_days" in resp.json()


@pytest.mark.asyncio
async def test_full_pro_flow(client, db_session, seed_user):
    seed_user.subscription_tier="pro"; await db_session.commit()
    token=create_access_token({"sub": str(seed_user.id)})
    h= {"Authorization": f"Bearer {token}"}
    for path in ["/api/pro/skills/top", "/api/pro/tools/top", "/api/pro/languages/top", "/api/pro/benefits/top", "/api/pro/requirements/experience"]:
        assert (await client.get(path, headers=h)).status_code==200
    xlsx = await client.get("/api/pro/export.xlsx?kind=all&limit=5", headers=h)
    assert len(xlsx.content) > 1000
    rep = await client.post("/api/pro/report?category=AI", headers=h)
    assert "narrative" in rep.json()


@pytest.mark.asyncio
async def test_raw_jd_requires_auth(client):
    resp = await client.get("/api/pro/jobs/vietnamworks/999999/raw")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_raw_jd_free_forbidden(client, db_session, seed_user):
    seed_user.subscription_tier = "free"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/jobs/vietnamworks/999999/raw", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_raw_jd_pro_ok(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    # unknown id must be 404 (handles missing warehouse tables gracefully)
    resp = await client.get("/api/pro/jobs/__no_source__/999999999/raw", headers=h)
    assert resp.status_code == 404
    # if warehouse has data, also verify 200 path contains PII-stripped keys
    from sqlalchemy import text

    try:
        row = (await db_session.execute(text("SELECT source, source_job_id FROM dbt_dev_silver.silver_job_detail LIMIT 1"))).mappings().first()
    except Exception:
        await db_session.rollback()
        row = None
    if row is not None:
        src, sid = row["source"], str(row["source_job_id"])
        resp2 = await client.get(f"/api/pro/jobs/{src}/{sid}/raw", headers=h)
        assert resp2.status_code == 200
        data = resp2.json()
        assert "source" in data and "source_job_id" in data
        assert "job_description_text" in data and "job_requirement_text" in data
        assert "title" in data and "company_name" in data and "source_url" in data
        # PII must be stripped server-side: no raw email/phone should leak if present
        import re

        email_pat = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
        phone_pat = re.compile(r"0\d{9,10}")
        for key in ("job_description_text", "job_requirement_text"):
            val = data.get(key) or ""
            assert not email_pat.search(val), f"PII email leaked in {key}"
            assert not phone_pat.search(val), f"PII phone leaked in {key}"


@pytest.mark.asyncio
async def test_export_raw_pro_ok(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&category=AI", headers=h)
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert len(resp.content) > 1000
    # verify it is a valid xlsx with raw_jds sheet
    from io import BytesIO
    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(resp.content))
    assert "raw_jds" in wb.sheetnames
    ws = wb["raw_jds"]
    header = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
    assert "source" in header and "source_job_id" in header
    assert "job_description_text" in header and "job_requirement_text" in header


@pytest.mark.asyncio
async def test_export_raw_free_forbidden(client, db_session, seed_user):
    seed_user.subscription_tier = "free"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/export.xlsx?kind=raw&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_export_raw_invalid_kind(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/export.xlsx?kind=INVALID&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 422
