"""Tests cho GET /api/admin/analytics/overview.

Test quan trong nhat la `test_umami_failure_becomes_error_status_not_zero`:
mot nguon chet phai hien ra la "khong biet", khong duoc bien thanh so 0. Zero
gia lam nguoi doc dashboard ket luan "thang nay khong ai vao" trong khi thuc te
la "he thong do dem hong" — va do la kieu sai lam ma khong ai phat hien ra.
"""
import pytest

from app.services.analytics import umami_client


@pytest.mark.asyncio
async def test_requires_authentication(client):
    resp = await client.get("/api/admin/analytics/overview")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_regular_user_gets_403(client, auth_headers):
    resp = await client.get("/api/admin/analytics/overview", headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_umami_failure_becomes_error_status_not_zero(
    client, admin_auth_headers, monkeypatch
):
    async def boom(*args, **kwargs):
        raise umami_client.UmamiUnavailable("down")

    monkeypatch.setattr("app.api.analytics.fetch_traffic", boom)
    monkeypatch.setattr("app.api.analytics.fetch_sources", boom)

    resp = await client.get("/api/admin/analytics/overview", headers=admin_auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["traffic"]["status"] == "error"
    assert body["traffic"]["data"] is None
    # Postgres-backed blocks are unaffected by Umami being down.
    assert body["activity"]["status"] == "ok"


@pytest.mark.asyncio
async def test_broken_umami_response_is_not_cached(
    client, admin_auth_headers, monkeypatch
):
    """Mot loi khong duoc dinh vao cache 10 phut.

    Neu cache ca response hong thi Umami song lai luc 10:01 nhung dashboard van
    bao "khong phan hoi" den 10:10 — va nguoi truc se di dieu tra mot su co da
    het tu lau.
    """
    async def boom(*args, **kwargs):
        raise umami_client.UmamiUnavailable("down")

    monkeypatch.setattr("app.api.analytics.fetch_traffic", boom)
    monkeypatch.setattr("app.api.analytics.fetch_sources", boom)

    written: list[str] = []

    async def spy_set(key, value, ttl):
        written.append(key)

    monkeypatch.setattr("app.api.analytics.cache_set_json", spy_set)

    resp = await client.get("/api/admin/analytics/overview", headers=admin_auth_headers)

    assert resp.status_code == 200
    assert written == []
