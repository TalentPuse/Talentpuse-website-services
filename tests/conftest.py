"""Pytest configuration and shared fixtures.

This file provides common fixtures for all tests.
"""
from __future__ import annotations

import pytest
import asyncio

from app.core.database import async_session_factory, init_db


@pytest.fixture(autouse=True, scope="session")
def setup_event_loop():
    """Set up event loop for the test session."""
    import asyncio.windows_events
    policy = asyncio.windows_events.WindowsSelectorEventLoopPolicy()
    asyncio.set_event_loop_policy(policy)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield
    loop.close()


@pytest.fixture(autouse=True)
async def initialize_database():
    """Initialize database for each test session."""
    # Only initialize if not already initialized
    if async_session_factory is None:
        await init_db()
    yield
    # No cleanup needed between tests


@pytest.fixture
async def db_session():
    """Async database session fixture for tests.

    This fixture creates a fresh async session for each test.
    Tests can use it like:

    async def test_something(db_session):
        # Use db_session for database operations
        result = await db_session.execute(query)
    """
    if async_session_factory is None:
        pytest.fail("Database not initialized. Call init_db() first.")

    async with async_session_factory() as session:
        yield session
