"""Pytest configuration and shared fixtures.

This file provides common fixtures for all tests.
"""
from __future__ import annotations

import os
import sys
import uuid

# Must run BEFORE anything imports app.core.config, which now refuses to boot on a
# missing or placeholder secret rather than quietly falling back to one.
#
# Assigned, not setdefault: the test suite must not inherit whatever secret happens
# to be in the ambient environment. Otherwise it either picks up a real production
# secret, or — as on this project's dev box — a leftover placeholder that config
# now rejects, and every test errors on import for reasons that have nothing to do
# with the code under test.
os.environ["JWT_SECRET"] = "test-only-jwt-secret-not-used-in-any-real-env"
os.environ["TELEGRAM_WEBHOOK_SECRET"] = "test-only-webhook-secret-value"

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.core import database as db_module  # noqa: E402
from app.core.security import create_access_token
from app.main import app
from app.models.user import User


@pytest.fixture(autouse=True, scope="session")
def setup_event_loop():
    """Set up event loop for the test session (cross-platform)."""
    import asyncio
    # Only use WindowsSelectorEventLoopPolicy on Windows
    if sys.platform == "win32":
        import asyncio.windows_events
        policy = asyncio.windows_events.WindowsSelectorEventLoopPolicy()
        asyncio.set_event_loop_policy(policy)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield
    loop.close()


@pytest_asyncio.fixture(autouse=True)
async def initialize_database():
    """(Re)initialize the DB engine for each test.

    pytest-asyncio runs each test coroutine on its own event loop by default
    (function-scoped), but asyncpg connections are bound to the loop they were
    created on. Reusing a single module-level engine/pool across tests running
    on different loops raises asyncpg InterfaceError ("another operation is in
    progress"). Recreating the engine per test keeps it bound to the current
    test's loop.
    """
    await db_module.close_db()
    await db_module.init_db()
    yield
    # No cleanup needed between tests


@pytest_asyncio.fixture
async def db_session():
    """Async database session fixture for tests.

    This fixture creates a fresh async session for each test.
    Tests can use it like:

    async def test_something(db_session):
        # Use db_session for database operations
        result = await db_session.execute(query)
    """
    if db_module.async_session_factory is None:
        pytest.fail("Database not initialized. Call init_db() first.")

    async with db_module.async_session_factory() as session:
        yield session


@pytest.fixture
def session_factory():
    """The app's `async_sessionmaker`, for tools/services that open their own
    session independent of `db_session` (e.g. chat agent tools).

    `initialize_database` (autouse) has already called `init_db()` by the time
    this fixture is requested, so `db_module.async_session_factory` is bound
    to the current test's DB engine.
    """
    if db_module.async_session_factory is None:
        pytest.fail("Database not initialized. Call init_db() first.")
    return db_module.async_session_factory


@pytest_asyncio.fixture
async def seed_user(db_session):
    """Persisted `app.users` row for tests that need a real FK target.

    Creates a user with a unique email per test invocation, yields it, then
    deletes it (cascading to any dependent rows created during the test).
    """
    user = User(
        email=f"test-{uuid.uuid4()}@example.com",
        hashed_password="test-hash",
        full_name="Test User",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    yield user

    await db_session.delete(user)
    await db_session.commit()


@pytest_asyncio.fixture
async def client():
    """Async HTTP client against the real app (in-process, real DB).

    No dependency overrides here: requests go through the actual `get_db` /
    `get_current_user` dependencies, so tests exercise real auth + real
    Postgres (per `initialize_database` above).
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_headers(seed_user):
    """Bearer header carrying a real JWT for a real, persisted `seed_user`."""
    token = create_access_token({"sub": str(seed_user.id)})
    return {"Authorization": f"Bearer {token}"}
