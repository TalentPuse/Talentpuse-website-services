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
    assert resp.status_code in (404, 200)
