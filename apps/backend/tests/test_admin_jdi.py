"""Admin JDI — tao/revoke API key, trigger extract noi bo."""
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.paid_quota import hash_key


async def test_tao_key_chi_tra_key_tho_mot_lan(admin_auth_headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/api-keys", headers=admin_auth_headers,
                         json={"name": "Khach A", "quota_month": 5000})
    assert r.status_code == 200
    body = r.json()
    assert len(body["api_key"]) >= 32


async def test_tao_key_khong_admin_403(seed_user):
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(seed_user.id)})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/api-keys", headers={"Authorization": f"Bearer {token}"},
                         json={"name": "X", "quota_month": 10})
    assert r.status_code == 403


async def test_list_key_khong_lo_hash(admin_auth_headers, db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        await c.post("/api/admin/api-keys", headers=admin_auth_headers,
                     json={"name": "Khach B", "quota_month": 10})
        r = await c.get("/api/admin/api-keys", headers=admin_auth_headers)
    body = r.json()
    assert any(k["name"] == "Khach B" for k in body["keys"])
    assert all("key_hash" not in k for k in body["keys"])


async def test_revoke_key_theo_hash(admin_auth_headers, db_session):
    from sqlalchemy import select

    from app.models.api_key import ApiKey

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        created = await c.post("/api/admin/api-keys", headers=admin_auth_headers,
                               json={"name": "Khach C", "quota_month": 10})
    kh = hash_key(created.json()["api_key"])
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(f"/api/admin/api-keys/{kh}/revoke", headers=admin_auth_headers)
    assert r.status_code == 200
    row = (await db_session.execute(
        select(ApiKey).where(ApiKey.key_hash == kh)
    )).scalar_one()
    assert row.is_active is False


async def test_extract_internal_yeu_cau_secret(client):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/jd/extract")
    assert r.status_code == 403


async def test_extract_happy_path(monkeypatch):
    secret = "test-only-webhook-secret-value"
    calls = {}

    async def fake_pipeline(db, limit=50):
        calls["limit"] = limit
        return 7

    monkeypatch.setattr("app.api.admin.run_extract_pipeline", fake_pipeline)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/jd/extract",
                         headers={"X-Webhook-Secret": secret, "X-Extract-Limit": "200"})
    assert r.status_code == 200
    assert r.json() == {"extracted": 7}
    assert calls["limit"] == 200


async def test_extract_limit_khong_phai_so_tra_400(client):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/admin/jd/extract",
            headers={"X-Webhook-Secret": "test-only-webhook-secret-value",
                     "X-Extract-Limit": "abc"},
        )
    assert r.status_code == 400
    assert "X-Extract-Limit" in r.json()["detail"]


async def test_extract_limit_khong_bi_cap_tren(monkeypatch):
    calls = {}

    async def fake_pipeline(db, limit=50):
        calls["limit"] = limit
        return 3

    monkeypatch.setattr("app.api.admin.run_extract_pipeline", fake_pipeline)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/admin/jd/extract",
            headers={"X-Webhook-Secret": "test-only-webhook-secret-value",
                     "X-Extract-Limit": "9999"},
        )
    assert r.status_code == 200
    assert calls["limit"] == 9999
