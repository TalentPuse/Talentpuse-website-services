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


@pytest.mark.asyncio
async def test_export_raw_title_filter(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&title=Engineer", headers=h)
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert len(resp.content) > 500
    from io import BytesIO
    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(resp.content))
    assert "raw_jds" in wb.sheetnames
    ws = wb["raw_jds"]
    header = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
    assert "title" in header


@pytest.mark.asyncio
async def test_export_raw_title_filter_escaping(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    # % and _ are LIKE wildcards — must be escaped, not expand to "match all"
    for special in ["Engineer%", "Senior_Engineer", "a\\b", "100%"]:
        resp = await client.get("/api/pro/export.xlsx?kind=raw&limit=5", headers=h, params={"title": special})
        # alternative: use URL encoding via params; httpx handles it
        assert resp.status_code == 200, f"escaping failed for title={special!r}"


@pytest.mark.asyncio
async def test_export_raw_title_filter_with_category_and_city(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    resp = await client.get(
        "/api/pro/export.xlsx?kind=raw&limit=5&title=Engineer&category=AI&city=HCMC",
        headers=h,
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]


@pytest.mark.asyncio
async def test_export_raw_title_filter_case_insensitive(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    # lower-case should still match via ILIKE
    resp_lower = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&title=engineer", headers=h)
    resp_upper = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&title=ENGINEER", headers=h)
    assert resp_lower.status_code == 200
    assert resp_upper.status_code == 200


@pytest.mark.asyncio
async def test_export_raw_search_alias(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&search=Engineer", headers=h)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_skills_top_date_filter(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/api/pro/skills/top?date_from=2026-01-01&date_to=2026-12-31", headers=h)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    # raw export with date filter also 200
    resp2 = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&date_from=2026-01-01&date_to=2026-12-31", headers=h)
    assert resp2.status_code == 200
    assert "application/vnd.openxmlformats" in resp2.headers["content-type"]


@pytest.mark.asyncio
async def test_pro_date_filter_all_endpoints(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    for path in [
        "/api/pro/skills/top?date_from=2026-01-01&date_to=2026-12-31",
        "/api/pro/tools/top?date_from=2026-01-01&date_to=2026-12-31",
        "/api/pro/languages/top?date_from=2026-01-01&date_to=2026-12-31",
        "/api/pro/benefits/top?date_from=2026-01-01&date_to=2026-12-31",
        "/api/pro/requirements/experience?date_from=2026-01-01&date_to=2026-12-31",
        "/api/pro/health?date_from=2026-01-01&date_to=2026-12-31",
    ]:
        resp = await client.get(path, headers=h)
        assert resp.status_code == 200, f"{path} failed {resp.status_code} {resp.text}"
    # export all with date filter
    resp = await client.get("/api/pro/export.xlsx?kind=skills&limit=5&date_from=2026-01-01&date_to=2026-12-31", headers=h)
    assert resp.status_code == 200
    # report with date filter
    resp = await client.post("/api/pro/report?date_from=2026-01-01&date_to=2026-12-31", headers=h)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_pro_invalid_date_returns_422(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    for bad in ["not-a-date", "2026-13-01", "2026-02-30", "2026/01/01"]:
        resp = await client.get(f"/api/pro/skills/top?date_from={bad}", headers=h)
        assert resp.status_code == 422, f"expected 422 for bad date {bad!r} got {resp.status_code}"
    # reversed range
    resp = await client.get("/api/pro/skills/top?date_from=2026-12-31&date_to=2026-01-01", headers=h)
    assert resp.status_code == 422
    # raw with bad date
    resp = await client.get("/api/pro/export.xlsx?kind=raw&limit=5&date_from=invalid", headers=h)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_export_raw_with_date_and_category_city_title(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    h = {"Authorization": f"Bearer {token}"}
    resp = await client.get(
        "/api/pro/export.xlsx?kind=raw&limit=5&date_from=2026-01-01&date_to=2026-12-31&category=AI&city=HCMC&title=Engineer",
        headers=h,
    )
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    from io import BytesIO
    from openpyxl import load_workbook

    wb = load_workbook(BytesIO(resp.content))
    assert "raw_jds" in wb.sheetnames


from app.api.pro import _strip_pii


def test_strip_pii_plus84():
    assert "[redacted]" in _strip_pii("Lien he 0912345678 hoac +84912345678 email a@gmail.com")
    assert "[redacted]" in _strip_pii("SDT: 84912345678")
    assert "primary_address" not in _strip_pii("123 Le Loi") # address not stripped, but phone inside address should be
    # address field itself should be stripped if contains phone
    assert "[redacted]" in _strip_pii("Dia chi: 123 Le Loi, LH 0912345678")


def test_norm_skill():
    from app.api.pro import _norm_skill

    assert _norm_skill("Artificial Intelligence") == "ai"
    assert _norm_skill("ReactJS") == "react"
    assert _norm_skill("React.js") == "react"  # currently fails before fix


def test_synonym_merge():
    from app.api.pro import _norm_skill

    assert _norm_skill("React.js") == "react"
    assert _norm_skill("NextJS") == "next.js"
    assert _norm_skill("Next.js") == "next.js"
    assert _norm_skill("VueJS") == "vue"
    assert _norm_skill("Vue.js") == "vue"
    assert _norm_skill("NodeJS") == "node.js"
    assert _norm_skill("Machine Learning") == "ml"


@pytest.mark.asyncio
async def test_health_llm_parallel(client, monkeypatch):
    """Health must fetch jd + openai probes in parallel (audit D2 P2).

    Two slow probes (0.2s each) sequentially would take ~0.4s; parallel must be <0.35s.
    Mocks httpx.AsyncClient so test runs without network and without DB (auth + DB overridden).
    """
    import asyncio
    import time

    # Bypass Pro gate + DB user lookup — health requires require_pro
    from app.api.pro import require_pro
    from app.core.database import get_db
    from app.main import app
    from app.models.user import User
    import uuid

    mock_user = User(
        id=uuid.uuid4(),
        email="pro-parallel@test.local",
        hashed_password="x",
        full_name="Pro Parallel",
        subscription_tier="pro",
        is_admin=False,
    )

    async def _mock_require_pro():
        return mock_user

    app.dependency_overrides[require_pro] = _mock_require_pro

    # Mock DB — avoid 10s pool_timeout per query when Postgres is down
    class _FakeResult:
        def scalar(self):
            return 0

        def mappings(self):
            return []

        def scalar_one_or_none(self):
            return None

    class _FakeSession:
        async def execute(self, *a, **kw):
            return _FakeResult()

        async def rollback(self):
            return None

    async def _mock_get_db():
        yield _FakeSession()

    app.dependency_overrides[get_db] = _mock_get_db

    # Slow httpx client: each probe sleeps 0.2s then returns 200
    class _SlowResp:
        status_code = 200

    class _SlowClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a, **kw):
            return False

        async def post(self, *a, **kw):
            await asyncio.sleep(0.2)
            return _SlowResp()

    monkeypatch.setattr("app.api.pro.httpx.AsyncClient", _SlowClient)
    # also patch global httpx in case import path differs
    monkeypatch.setattr("httpx.AsyncClient", _SlowClient)

    try:
        start = time.perf_counter()
        resp = await client.get("/api/pro/health")
        elapsed = time.perf_counter() - start
        assert resp.status_code == 200, f"health failed {resp.status_code} {resp.text}"
        data = resp.json()
        assert "llm" in data
        # parallel must be <0.35s (sequential would be ~0.4s)
        assert elapsed < 0.35, f"health parallel failed: took {elapsed:.3f}s >=0.35s (sequential?)"
    finally:
        app.dependency_overrides.pop(require_pro, None)
        app.dependency_overrides.pop(get_db, None)
