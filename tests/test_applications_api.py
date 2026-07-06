import pytest


@pytest.mark.asyncio
async def test_create_manual_then_list_and_stats(client, auth_headers):
    r = await client.post("/api/applications", json={"title": "Data Eng", "company_name": "Acme"}, headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["source"] == "manual" and r.json()["status"] == "applied"
    assert (await client.get("/api/applications", headers=auth_headers)).json()["total"] == 1
    assert (await client.get("/api/applications/stats", headers=auth_headers)).json()["by_status"]["applied"] == 1


@pytest.mark.asyncio
async def test_patch_status_and_delete(client, auth_headers):
    app = (await client.post("/api/applications", json={"title": "X"}, headers=auth_headers)).json()
    r = await client.patch(f"/api/applications/{app['id']}", json={"status": "interviewing"}, headers=auth_headers)
    assert r.json()["status"] == "interviewing"
    assert (await client.delete(f"/api/applications/{app['id']}", headers=auth_headers)).status_code == 204


@pytest.mark.asyncio
async def test_requires_auth(client):
    assert (await client.get("/api/applications")).status_code == 401


@pytest.mark.asyncio
async def test_create_manual_requires_title(client, auth_headers):
    assert (await client.post("/api/applications", json={"company_name": "NoTitle"}, headers=auth_headers)).status_code == 422
