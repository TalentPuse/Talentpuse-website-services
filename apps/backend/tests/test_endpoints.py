"""Tests for dashboard API + auth endpoints.

Mock DB session so tests run without Postgres (CI-friendly).
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app


# ─────────────────────────────────────────────
# Fake DB layer for dashboard routes
# ─────────────────────────────────────────────

FAKE_OVERVIEW = {"total_jobs": 42, "pct_with_salary": 65.0, "avg_salary_million": 25.5}
FAKE_SKILL = {"skill": "Python", "n_jobs": 30, "pct_of_jobs": 71.4}
FAKE_PAYING = {"skill": "Spark", "n_jobs": 10, "avg_salary_million": 45.0}
FAKE_SALARY = {
    "level_city": "Senior - Ho Chi Minh",
    "job_level": "Senior",
    "city_canonical": "Ho Chi Minh",
    "p25_million": 20.0,
    "p50_million": 30.0,
    "p75_million": 40.0,
    "n_visible_jobs": 15,
}
FAKE_COMPANY = {
    "company_name": "FPT",
    "n_jobs": 25,
    "primary_city": "Ha Noi",
    "avg_views": 1200.0,
    "avg_salary_million": 22.0,
}


class _MappingResult:
    def __init__(self, rows):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def all(self):
        return self._rows


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def mappings(self):
        return _MappingResult(self._rows)


class FakeSession:
    """Mimics AsyncSession for dashboard queries (text() SQL)."""

    async def execute(self, stmt, params=None):
        sql = str(stmt).lower()
        if "fct_jobs_daily" in sql:
            return _Result([FAKE_OVERVIEW])
        if "mart_skill_demand" in sql and "avg_salary_vnd" in sql:
            return _Result([FAKE_PAYING])
        if "mart_skill_demand" in sql:
            return _Result([FAKE_SKILL])
        if "mart_salary_by_level" in sql:
            return _Result([FAKE_SALARY])
        if "mart_company_hiring" in sql:
            return _Result([FAKE_COMPANY])
        return _Result([])

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass

    def add(self, obj):
        pass


async def _fake_get_db():
    yield FakeSession()


@pytest.fixture(autouse=True)
def _override_db():
    app.dependency_overrides[get_db] = _fake_get_db
    yield
    app.dependency_overrides.clear()


# ─────────────────────────────────────────────
# Fake user helper
# ─────────────────────────────────────────────

def _make_fake_user(**overrides):
    from app.models.user import User

    defaults = dict(
        id=uuid4(),
        email="test@example.com",
        hashed_password="$2b$12$fakehashfakehashfakehashfakehashfakehashfakehash",
        full_name="Nguyễn Văn Test",
        skills=["Python", "React"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Hồ Chí Minh"],
        desired_titles=["AI Engineer"],
        is_active=True,
        is_admin=False,
        subscription_tier="free",
        experience_level=None,
        university=None,
        graduation_year=None,
        open_to_internship=False,
        part_time_ok=False,
        created_at=datetime(2026, 1, 15, 10, 0, 0),
        updated_at=datetime(2026, 1, 15, 10, 0, 0),
    )
    defaults.update(overrides)
    user = MagicMock(spec=User)
    # spec=User khien moi thuoc tinh tra ve MagicMock thay vi None, nen Pydantic
    # nhan MagicMock cho `cv_file_url` va nem "Input should be a valid string".
    # Mock cu hon schema: UserResponse them field nay sau. API that van chay dung
    # (GET/PUT /api/auth/me deu 200) — day thuan tuy la loi test.
    user.cv_file_url = None
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


# ─────────────────────────────────────────────
# Health check
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "talentpulse-dashboard-api"


# ─────────────────────────────────────────────
# Dashboard — overview
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_overview_returns_shape():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/overview")
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["total_jobs"], int)
    assert isinstance(d["pct_with_salary"], float)
    assert d["avg_salary_million"] is None or isinstance(d["avg_salary_million"], float)


# ─────────────────────────────────────────────
# Dashboard — skills
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_top_skills_default_limit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/skills/top")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        assert {"skill", "n_jobs", "pct_of_jobs"} <= rows[0].keys()


@pytest.mark.asyncio
async def test_top_skills_with_limit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/skills/top?limit=3")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_top_skills_invalid_limit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/skills/top?limit=0")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_highest_paying_skills():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/skills/highest-paying?limit=5")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        assert "avg_salary_million" in rows[0]


# ─────────────────────────────────────────────
# Dashboard — salary
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_salary_by_level():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/salary/by-level")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        assert {"level_city", "job_level", "p50_million"} <= rows[0].keys()


# ─────────────────────────────────────────────
# Dashboard — companies
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_top_companies_default():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/companies/top")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        assert "company_name" in rows[0]


@pytest.mark.asyncio
async def test_top_companies_with_limit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/companies/top?limit=5")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_top_companies_invalid_limit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/companies/top?limit=999")
    assert r.status_code == 422


# ─────────────────────────────────────────────
# Auth — signup
# ─────────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.asyncio
async def test_signup_success():
    fake_user = _make_fake_user()

    with patch("app.api.auth.get_user_by_email", return_value=None), \
         patch("app.api.auth.create_user", return_value=(fake_user, "jwt-token-123")):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/signup", json={
                "email": "new@example.com",
                "password": "strongpass123",
                "full_name": "Nguyễn Mới",
                "skills": ["Python"],
                "desired_salary_min": 15_000_000,
                "desired_salary_max": 30_000_000,
                "preferred_cities": ["Hà Nội"],
            })

    assert r.status_code == 201
    body = r.json()
    assert body["access_token"] == "jwt-token-123"
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_signup_duplicate_email():
    existing_user = _make_fake_user(email="taken@example.com")

    with patch("app.api.auth.get_user_by_email", return_value=existing_user):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/signup", json={
                "email": "taken@example.com",
                "password": "strongpass123",
                "full_name": "Duplicate",
            })

    assert r.status_code == 409
    assert "đã được đăng ký" in r.json()["detail"]


@pytest.mark.asyncio
async def test_signup_short_password():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/auth/signup", json={
            "email": "short@example.com",
            "password": "abc",
            "full_name": "Short Pass",
        })

    assert r.status_code == 400
    assert "ít nhất 8" in r.json()["detail"]


@pytest.mark.asyncio
async def test_signup_invalid_email():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/auth/signup", json={
            "email": "not-an-email",
            "password": "strongpass123",
            "full_name": "Bad Email",
        })

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_signup_missing_fields():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/auth/signup", json={
            "email": "missing@example.com",
        })

    assert r.status_code == 422


@pytest.mark.asyncio
async def test_signup_with_full_profile():
    fake_user = _make_fake_user(
        skills=["Python", "Docker", "AWS"],
        desired_salary_min=30_000_000,
        desired_salary_max=60_000_000,
        preferred_cities=["Hồ Chí Minh", "Hà Nội"],
    )

    with patch("app.api.auth.get_user_by_email", return_value=None), \
         patch("app.api.auth.create_user", return_value=(fake_user, "jwt-full-profile")):

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/signup", json={
                "email": "fullprofile@example.com",
                "password": "strongpass123",
                "full_name": "Trần Full Profile",
                "skills": ["Python", "Docker", "AWS"],
                "desired_salary_min": 30_000_000,
                "desired_salary_max": 60_000_000,
                "preferred_cities": ["Hồ Chí Minh", "Hà Nội"],
            })

    assert r.status_code == 201
    assert r.json()["access_token"] == "jwt-full-profile"


# ─────────────────────────────────────────────
# Auth — login
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_success():
    fake_user = _make_fake_user()

    with patch("app.api.auth.authenticate_user", return_value=(fake_user, "jwt-login")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "correctpassword",
            })

    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "jwt-login"
    assert body["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password():
    with patch("app.api.auth.authenticate_user", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/login", json={
                "email": "test@example.com",
                "password": "wrongpassword",
            })

    assert r.status_code == 401
    assert "không đúng" in r.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_email():
    with patch("app.api.auth.authenticate_user", return_value=None):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/auth/login", json={
                "email": "noone@example.com",
                "password": "somepassword",
            })

    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_invalid_email_format():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/auth/login", json={
            "email": "bad-email",
            "password": "somepassword",
        })

    assert r.status_code == 422


# ─────────────────────────────────────────────
# Auth — GET /me
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_me_success():
    fake_user = _make_fake_user()
    from app.core.security import get_current_user

    async def _override_user():
        return fake_user

    app.dependency_overrides[get_current_user] = _override_user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer fake-token"},
        )

    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "test@example.com"
    assert body["full_name"] == "Nguyễn Văn Test"
    assert body["skills"] == ["Python", "React"]
    assert body["desired_salary_min"] == 20_000_000
    assert body["desired_salary_max"] == 40_000_000
    assert body["preferred_cities"] == ["Hồ Chí Minh"]
    assert "id" in body
    assert "created_at" in body


@pytest.mark.asyncio
async def test_me_no_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/auth/me")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_invalid_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer totally.invalid.token"},
        )
    assert r.status_code == 401


# ─────────────────────────────────────────────
# Auth — PUT /me
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_me_success():
    fake_user = _make_fake_user()
    fake_db = AsyncMock()
    fake_db.commit = AsyncMock()
    fake_db.refresh = AsyncMock()

    from app.core.security import get_current_user

    async def _override_user():
        return fake_user

    async def _override_db():
        yield fake_db

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.put(
            "/api/auth/me",
            headers={"Authorization": "Bearer fake-token"},
            json={
                "full_name": "Nguyễn Updated",
                "skills": ["Go", "Kubernetes"],
                "desired_salary_min": 30_000_000,
                "preferred_cities": ["Đà Nẵng"],
            },
        )

    assert r.status_code == 200
    assert fake_user.full_name == "Nguyễn Updated"
    assert fake_user.skills == ["Go", "Kubernetes"]
    assert fake_user.desired_salary_min == 30_000_000
    assert fake_user.preferred_cities == ["Đà Nẵng"]
    fake_db.commit.assert_awaited_once()
    fake_db.refresh.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_me_partial():
    """Only update skills, leave the rest untouched."""
    fake_user = _make_fake_user(
        full_name="Original Name",
        skills=["Java"],
        desired_salary_min=10_000_000,
    )
    fake_db = AsyncMock()

    from app.core.security import get_current_user

    async def _override_user():
        return fake_user

    async def _override_db():
        yield fake_db

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.put(
            "/api/auth/me",
            headers={"Authorization": "Bearer fake-token"},
            json={"skills": ["Rust", "Zig"]},
        )

    assert r.status_code == 200
    assert fake_user.skills == ["Rust", "Zig"]
    assert fake_user.full_name == "Original Name"
    assert fake_user.desired_salary_min == 10_000_000


@pytest.mark.asyncio
async def test_update_me_no_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.put("/api/auth/me", json={"full_name": "Hacker"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_update_me_empty_body():
    """Empty update body should still return 200 (no changes)."""
    fake_user = _make_fake_user()
    fake_db = AsyncMock()

    from app.core.security import get_current_user

    async def _override_user():
        return fake_user

    async def _override_db():
        yield fake_db

    app.dependency_overrides[get_current_user] = _override_user
    app.dependency_overrides[get_db] = _override_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.put(
            "/api/auth/me",
            headers={"Authorization": "Bearer fake-token"},
            json={},
        )

    assert r.status_code == 200


# ─────────────────────────────────────────────
# Unit tests — security functions
# ─────────────────────────────────────────────

def test_hash_and_verify_password():
    from app.core.security import hash_password, verify_password

    hashed = hash_password("mypassword123")
    assert hashed != "mypassword123"
    assert hashed.startswith("$2b$")
    assert verify_password("mypassword123", hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_create_and_decode_token():
    from jose import jwt

    from app.core.config import JWT_ALGORITHM, JWT_SECRET
    from app.core.security import create_access_token

    token = create_access_token({"sub": "user-123"})
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert payload["sub"] == "user-123"
    assert "exp" in payload


def test_token_contains_expiry():
    from jose import jwt

    from app.core.config import JWT_ALGORITHM, JWT_SECRET
    from app.core.security import create_access_token

    token = create_access_token({"sub": "test-id"})
    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    assert "exp" in payload


# ─────────────────────────────────────────────
# Unit tests — service layer
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_service_create_user():
    from app.schemas.auth import UserCreate
    from app.services.auth import create_user

    fake_db = AsyncMock()
    fake_db.add = MagicMock()

    async def fake_refresh(obj):
        obj.id = uuid4()

    fake_db.refresh = fake_refresh

    data = UserCreate(
        email="service@test.com",
        password="password123",
        full_name="Service Test",
        skills=["Python"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Hồ Chí Minh"],
    )

    user, token = await create_user(fake_db, data)
    assert user.email == "service@test.com"
    assert user.hashed_password != "password123"
    assert isinstance(token, str) and len(token) > 0
    # 2 lan add: user + AlertSubscription(email_job_match, enabled=True) mac dinh
    assert fake_db.add.call_count == 2
    sub = fake_db.add.call_args_list[1][0][0]
    assert sub.alert_type == 'email_job_match'
    assert sub.enabled is True
    fake_db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_service_authenticate_success():
    from app.core.security import hash_password
    from app.services.auth import authenticate_user

    fake_user = _make_fake_user(
        hashed_password=hash_password("correct_password"),
    )

    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_user

    fake_db = AsyncMock()
    fake_db.execute.return_value = fake_result

    result = await authenticate_user(fake_db, "test@example.com", "correct_password")
    assert result is not None
    user, token = result
    assert user.email == "test@example.com"
    assert isinstance(token, str)


@pytest.mark.asyncio
async def test_service_authenticate_wrong_password():
    from app.core.security import hash_password
    from app.services.auth import authenticate_user

    fake_user = _make_fake_user(
        hashed_password=hash_password("correct_password"),
    )

    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_user

    fake_db = AsyncMock()
    fake_db.execute.return_value = fake_result

    result = await authenticate_user(fake_db, "test@example.com", "wrong_password")
    assert result is None


@pytest.mark.asyncio
async def test_service_authenticate_no_user():
    from app.services.auth import authenticate_user

    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = None

    fake_db = AsyncMock()
    fake_db.execute.return_value = fake_result

    result = await authenticate_user(fake_db, "nobody@example.com", "password")
    assert result is None


@pytest.mark.asyncio
async def test_service_get_user_by_email_found():
    from app.services.auth import get_user_by_email

    fake_user = _make_fake_user()
    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = fake_user

    fake_db = AsyncMock()
    fake_db.execute.return_value = fake_result

    user = await get_user_by_email(fake_db, "test@example.com")
    assert user is not None
    assert user.email == "test@example.com"


@pytest.mark.asyncio
async def test_service_get_user_by_email_not_found():
    from app.services.auth import get_user_by_email

    fake_result = MagicMock()
    fake_result.scalar_one_or_none.return_value = None

    fake_db = AsyncMock()
    fake_db.execute.return_value = fake_result

    user = await get_user_by_email(fake_db, "nobody@example.com")
    assert user is None
