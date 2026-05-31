"""Unit tests for interview agent storage layer.

Tests database operations for sessions and messages.
These tests require a running PostgreSQL database.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import select

from app.core import database as db_module


@pytest.fixture
async def db_session():
    """Async database session fixture for tests."""
    # Initialize database if not already initialized
    if db_module.async_session_factory is None:
        await db_module.init_db()

    if db_module.async_session_factory is None:
        pytest.skip("Database not available - skipping storage tests")

    try:
        async with db_module.async_session_factory() as session:
            # Eagerly test connection to detect unavailable DB
            from sqlalchemy import text
            await session.execute(text("SELECT 1"))
            yield session
    except (OSError, ConnectionError, Exception) as exc:
        pytest.skip(f"Database not reachable ({type(exc).__name__}) - skipping storage tests")


@pytest.mark.asyncio
class TestSessionStore:
    """Test interview session storage operations."""

    async def test_create_session(self, db_session):
        """Test creating a new interview session."""
        from app.services.interview_agent.storage.session_store import create_session

        user_id = uuid.uuid4()

        session = await create_session(
            user_id=user_id,
            mode="technical",
            target_role="Backend Engineer",
            num_questions=5,
        )

        assert session.id is not None
        assert session.user_id == user_id
        assert session.mode == "technical"
        assert session.target_role == "Backend Engineer"
        assert session.status == "created"
        assert session.question_count == 0

    async def test_get_session(self, db_session):
        """Test retrieving a session by ID."""
        from app.services.interview_agent.storage.session_store import (
            create_session,
            get_session,
        )

        user_id = uuid.uuid4()
        created = await create_session(
            user_id=user_id,
            mode="behavioral",
            target_role="Frontend Developer",
        )

        retrieved = await get_session(created.id)

        assert retrieved is not None
        assert retrieved.id == created.id
        assert retrieved.mode == "behavioral"

    async def test_get_session_not_found(self, db_session):
        """Test retrieving non-existent session returns None."""
        from app.services.interview_agent.storage.session_store import get_session

        result = await get_session(uuid.uuid4())
        assert result is None

    async def test_update_session(self, db_session):
        """Test updating session fields."""
        from app.services.interview_agent.storage.session_store import (
            create_session,
            update_session,
            get_session,
        )

        user_id = uuid.uuid4()
        session = await create_session(user_id=user_id, mode="technical")

        updated = await update_session(
            session.id,
            status="in_progress",
            question_count=1,
        )

        assert updated.status == "in_progress"
        assert updated.question_count == 1

    async def test_list_user_sessions(self, db_session):
        """Test listing sessions for a user."""
        from app.services.interview_agent.storage.session_store import (
            create_session,
            list_user_sessions,
        )

        user_id = uuid.uuid4()

        # Create multiple sessions
        await create_session(user_id=user_id, mode="technical")
        await create_session(user_id=user_id, mode="behavioral")
        await create_session(user_id=user_id, mode="technical")

        # List sessions
        sessions = await list_user_sessions(user_id=user_id)

        assert len(sessions) == 3
        assert all(s.user_id == user_id for s in sessions)

    async def test_list_sessions_with_limit(self, db_session):
        """Test listing sessions with pagination."""
        from app.services.interview_agent.storage.session_store import (
            create_session,
            list_user_sessions,
        )

        user_id = uuid.uuid4()

        # Create 5 sessions
        for i in range(5):
            await create_session(user_id=user_id, mode="technical")

        # List with limit
        sessions = await list_user_sessions(user_id=user_id, limit=3, offset=0)

        assert len(sessions) == 3

        # List with offset
        sessions_offset = await list_user_sessions(user_id=user_id, limit=3, offset=3)

        assert len(sessions_offset) == 2


@pytest.mark.asyncio
class TestMessageStore:
    """Test interview message storage operations."""

    async def test_create_message(self, db_session):
        """Test creating a new message."""
        from app.services.interview_agent.storage.session_store import create_session
        from app.services.interview_agent.storage.message_store import create_message

        session = await create_session(
            user_id=uuid.uuid4(), mode="behavioral"
        )

        message = await create_message(
            session_id=session.id,
            role="assistant",
            content="Hello! How can I help you today?",
        )

        assert message.id is not None
        assert message.session_id == session.id
        assert message.role == "assistant"
        assert message.content == "Hello! How can I help you today?"

    async def test_create_user_message(self, db_session):
        """Test creating user message."""
        from app.services.interview_agent.storage.session_store import create_session
        from app.services.interview_agent.storage.message_store import create_message

        session = await create_session(
            user_id=uuid.uuid4(), mode="technical"
        )

        message = await create_message(
            session_id=session.id,
            role="user",
            content="I'd like to design a URL shortener.",
        )

        assert message.role == "user"
        assert "URL shortener" in message.content

    async def test_get_session_messages(self, db_session):
        """Test retrieving all messages for a session."""
        from app.services.interview_agent.storage.session_store import create_session
        from app.services.interview_agent.storage.message_store import (
            create_message,
            get_session_messages,
        )

        session = await create_session(
            user_id=uuid.uuid4(), mode="behavioral"
        )

        # Create multiple messages
        await create_message(
            session_id=session.id, role="assistant", content="Greeting"
        )
        await create_message(
            session_id=session.id, role="user", content="Answer 1"
        )
        await create_message(
            session_id=session.id, role="assistant", content="Follow-up"
        )

        messages = await get_session_messages(session.id)

        assert len(messages) == 3
        assert messages[0].role == "assistant"
        assert messages[1].role == "user"
        assert messages[2].role == "assistant"

    async def test_get_session_messages_ordered(self, db_session):
        """Test that messages are ordered by created_at ascending."""
        from app.services.interview_agent.storage.session_store import create_session
        from app.services.interview_agent.storage.message_store import (
            create_message,
            get_session_messages,
        )

        session = await create_session(
            user_id=uuid.uuid4(), mode="technical"
        )

        # Create messages in sequence
        msg1 = await create_message(
            session_id=session.id, role="assistant", content="First"
        )
        msg2 = await create_message(
            session_id=session.id, role="user", content="Second"
        )
        msg3 = await create_message(
            session_id=session.id, role="assistant", content="Third"
        )

        messages = await get_session_messages(session.id)

        assert messages[0].id == msg1.id
        assert messages[1].id == msg2.id
        assert messages[2].id == msg3.id

    async def test_get_session_messages_with_limit(self, db_session):
        """Test retrieving messages with limit."""
        from app.services.interview_agent.storage.session_store import create_session
        from app.services.interview_agent.storage.message_store import (
            create_message,
            get_session_messages,
        )

        session = await create_session(
            user_id=uuid.uuid4(), mode="behavioral"
        )

        # Create 5 messages
        for i in range(5):
            await create_message(
                session_id=session.id,
                role="assistant" if i % 2 == 0 else "user",
                content=f"Message {i}",
            )

        messages = await get_session_messages(session.id, limit=3)

        assert len(messages) == 3

    async def test_message_with_audio_url(self, db_session):
        """Test creating message with audio URL (future voice feature)."""
        from app.services.interview_agent.storage.session_store import create_session
        from app.services.interview_agent.storage.message_store import create_message

        session = await create_session(
            user_id=uuid.uuid4(), mode="behavioral"
        )

        message = await create_message(
            session_id=session.id,
            role="assistant",
            content="Here's my response.",
            audio_url="s3://interview-audios/session-123/msg-456.mp3",
        )

        assert message.audio_url == "s3://interview-audios/session-123/msg-456.mp3"
