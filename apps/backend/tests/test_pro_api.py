import pytest
from app.core.security import create_access_token
from app.models.user import User


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
