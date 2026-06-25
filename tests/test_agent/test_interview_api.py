"""Integration tests for interview agent API endpoints.

Tests that the API follows the same pattern as chat.py

NOTE: We use sys.modules + patch.object because ``api/__init__.py``
exports an ``interview_router`` APIRouter instance that shadows the
Python module of the same name.  Plain ``patch("...interview_router.xxx")``
resolves to the router object, not the module.
"""
from __future__ import annotations

import sys
import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app

# Resolve the *module* object directly — bypasses the APIRouter shadow.
_router_mod = sys.modules["app.services.interview_agent.api.interview_router"]


@pytest.fixture
def mock_user():
    """Create mock authenticated user."""
    user = MagicMock()
    user.id = uuid.uuid4()
    user.full_name = "Test User"
    user.email = "test@example.com"
    user.skills = ["Python", "JavaScript"]
    user.desired_titles = ["Backend Engineer"]
    user.experience_level = "mid"
    user.preferred_cities = ["Ho Chi Minh", "Da Nang"]
    user.desired_salary_min = 20
    user.desired_salary_max = 40
    user.university = "FPT"
    user.graduation_year = 2023

    # Mock dict method
    user.dict = MagicMock(return_value={
        "full_name": "Test User",
        "email": "test@example.com",
        "skills": ["Python", "JavaScript"],
        "desired_titles": ["Backend Engineer"],
        "experience_level": "mid",
        "preferred_cities": ["Ho Chi Minh", "Da Nang"],
        "desired_salary_min": 20,
        "desired_salary_max": 40,
        "university": "FPT",
        "graduation_year": 2023,
    })

    return user


@pytest.fixture
def client(mock_user):
    """Create test client with mocked authentication and database."""
    from app.core.database import get_db

    async def override_get_current_user():
        return mock_user

    # Mock database session
    mock_db_session = AsyncMock()
    mock_db_session.__aenter__ = AsyncMock(return_value=mock_db_session)
    mock_db_session.__aexit__ = AsyncMock()
    mock_db_session.execute = AsyncMock()
    mock_db_session.scalars = MagicMock(return_value=[])
    mock_db_session.get = AsyncMock(return_value=None)
    mock_db_session.delete = MagicMock()
    mock_db_session.commit = AsyncMock()
    mock_db_session.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides = {}


class TestSessionEndpoints:
    """Test session CRUD endpoints."""

    def test_create_session_technical(self, client, mock_user):
        """Test creating a technical interview session."""
        mock_session = MagicMock()
        mock_session.id = uuid.uuid4()
        mock_session.user_id = mock_user.id
        mock_session.mode = "technical"
        mock_session.status = "in_progress"
        mock_session.target_role = "Backend Engineer"
        mock_session.question_count = 0
        mock_session.overall_score = None
        mock_session.overall_feedback = None
        mock_session.improvement_plan = None
        mock_session.created_at = "2024-01-01T00:00:00"
        mock_session.updated_at = "2024-01-01T00:00:00"

        mock_message = MagicMock()
        mock_message.id = uuid.uuid4()
        mock_message.session_id = mock_session.id
        mock_message.role = "assistant"
        mock_message.content = "Xin chào! Tôi là interviewer kỹ thuật..."
        mock_message.audio_url = None
        mock_message.created_at = "2024-01-01T00:00:00"

        with patch.object(_router_mod, "create_session", return_value=mock_session), \
             patch.object(_router_mod, "create_message", return_value=mock_message), \
             patch.object(_router_mod, "update_session", return_value=mock_session), \
             patch.object(_router_mod, "get_session_messages", return_value=[mock_message]):
            response = client.post(
                "/api/interview-agent/sessions",
                json={
                    "mode": "technical",
                    "target_role": "Backend Engineer",
                    "num_questions": 5,
                },
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "technical"
        assert data["target_role"] == "Backend Engineer"
        assert data["status"] == "in_progress"
        assert len(data["messages"]) == 1  # Greeting message

    def test_create_session_behavioral(self, client, mock_user):
        """Test creating a behavioral interview session."""
        mock_session = MagicMock()
        mock_session.id = uuid.uuid4()
        mock_session.user_id = mock_user.id
        mock_session.mode = "behavioral"
        mock_session.status = "in_progress"
        mock_session.target_role = "Frontend Developer"
        mock_session.question_count = 0
        mock_session.overall_score = None
        mock_session.overall_feedback = None
        mock_session.improvement_plan = None
        mock_session.created_at = "2024-01-01T00:00:00"
        mock_session.updated_at = "2024-01-01T00:00:00"

        mock_message = MagicMock()
        mock_message.id = uuid.uuid4()
        mock_message.session_id = mock_session.id
        mock_message.role = "assistant"
        mock_message.content = "Xin chào! Tôi là interviewer hành vi..."
        mock_message.audio_url = None
        mock_message.created_at = "2024-01-01T00:00:00"

        with patch.object(_router_mod, "create_session", return_value=mock_session), \
             patch.object(_router_mod, "create_message", return_value=mock_message), \
             patch.object(_router_mod, "update_session", return_value=mock_session), \
             patch.object(_router_mod, "get_session_messages", return_value=[mock_message]):
            response = client.post(
                "/api/interview-agent/sessions",
                json={
                    "mode": "behavioral",
                    "target_role": "Frontend Developer",
                    "num_questions": 3,
                },
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["mode"] == "behavioral"
        # Check that the greeting contains expected content
        assert "interviewer" in data["messages"][0]["content"].lower()

    def test_list_sessions(self, client, mock_user):
        """Test listing user's interview sessions."""
        mock_session1 = MagicMock()
        mock_session1.id = uuid.uuid4()
        mock_session1.user_id = mock_user.id
        mock_session1.mode = "technical"
        mock_session1.status = "completed"
        mock_session1.target_role = "Backend Engineer"
        mock_session1.question_count = 5
        mock_session1.overall_score = 4.0
        mock_session1.overall_feedback = "Good"
        mock_session1.improvement_plan = "Plan"
        mock_session1.created_at = "2024-01-01T00:00:00"
        mock_session1.updated_at = "2024-01-01T00:00:00"

        with patch.object(_router_mod, "list_user_sessions", return_value=[mock_session1]):
            response = client.get(
                "/api/interview-agent/sessions",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        result = response.json()
        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["mode"] == "technical"

    def test_get_session_detail(self, client, mock_user):
        """Test getting session details with messages."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id
        mock_session.mode = "technical"
        mock_session.status = "in_progress"
        mock_session.target_role = "Backend Engineer"
        mock_session.question_count = 2
        mock_session.overall_score = None
        mock_session.overall_feedback = None
        mock_session.improvement_plan = None
        mock_session.created_at = "2024-01-01T00:00:00"
        mock_session.updated_at = "2024-01-01T00:00:00"

        mock_message1 = MagicMock()
        mock_message1.id = uuid.uuid4()
        mock_message1.session_id = session_id
        mock_message1.role = "assistant"
        mock_message1.content = "Question 1"
        mock_message1.audio_url = None
        mock_message1.created_at = "2024-01-01T00:00:00"

        mock_message2 = MagicMock()
        mock_message2.id = uuid.uuid4()
        mock_message2.session_id = session_id
        mock_message2.role = "user"
        mock_message2.content = "Answer 1"
        mock_message2.audio_url = None
        mock_message2.created_at = "2024-01-01T00:01:00"

        with patch.object(_router_mod, "get_session", return_value=mock_session), \
             patch.object(_router_mod, "get_session_messages", return_value=[mock_message1, mock_message2]):
            response = client.get(
                f"/api/interview-agent/sessions/{session_id}",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(session_id)
        assert len(data["messages"]) == 2

    def test_delete_session(self, client, mock_user):
        """Test deleting an interview session."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id

        with patch.object(_router_mod, "get_session", return_value=mock_session):
            response = client.delete(
                f"/api/interview-agent/sessions/{session_id}",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200


class TestMessageEndpoints:
    """Test message sending with SSE streaming."""

    def test_send_message_non_streaming(self, client, mock_user):
        """Test sending message without streaming."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id
        mock_session.mode = "technical"
        mock_session.status = "in_progress"
        mock_session.question_count = 0
        mock_session.created_at = "2024-01-01T00:00:00"
        mock_session.updated_at = "2024-01-01T00:00:00"

        mock_agent = AsyncMock()
        mock_agent.ainvoke.return_value = {
            "messages": [
                MagicMock(content="User message"),
                MagicMock(content="That's a good approach!"),
            ]
        }

        mock_user_msg = MagicMock()
        mock_user_msg.id = uuid.uuid4()
        mock_user_msg.session_id = session_id
        mock_user_msg.role = "user"
        mock_user_msg.content = "I'd design it using microservices."
        mock_user_msg.audio_url = None
        mock_user_msg.created_at = "2024-01-01T00:00:00"

        mock_bot_msg = MagicMock()
        mock_bot_msg.id = uuid.uuid4()
        mock_bot_msg.session_id = session_id
        mock_bot_msg.role = "assistant"
        mock_bot_msg.content = "That's a good approach!"
        mock_bot_msg.audio_url = None
        mock_bot_msg.created_at = "2024-01-01T00:00:00"

        with patch.object(_router_mod, "get_session", return_value=mock_session), \
             patch.object(_router_mod, "create_message", side_effect=[mock_user_msg, mock_bot_msg]), \
             patch.object(_router_mod, "update_session", return_value=mock_session), \
             patch.object(_router_mod, "_load_session_history", return_value=[]), \
             patch.object(_router_mod, "get_interview_agent", return_value=mock_agent):
            response = client.post(
                f"/api/interview-agent/sessions/{session_id}/messages",
                json={"content": "I'd design it using microservices."},
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "user_message" in data
        assert "assistant_message" in data

    def test_send_message_streaming(self, client, mock_user):
        """Test sending message with SSE streaming."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id
        mock_session.mode = "behavioral"
        mock_session.status = "in_progress"
        mock_session.question_count = 0
        mock_session.total_questions = 10
        mock_session.created_at = "2024-01-01T00:00:00"
        mock_session.updated_at = "2024-01-01T00:00:00"

        # Mock streaming agent
        async def mock_astream(*args, **kwargs):
            """Mock streaming that yields chunks."""
            from langchain_core.messages import AIMessageChunk

            # Yield some chunks
            yield AIMessageChunk(content="That's"), {}
            yield AIMessageChunk(content=" a"), {}
            yield AIMessageChunk(content=" great"), {}
            yield AIMessageChunk(content=" STAR"), {}
            yield AIMessageChunk(content=" answer!"), {}

        mock_agent = AsyncMock()
        mock_agent.astream = mock_astream

        mock_user_msg = MagicMock()
        mock_user_msg.id = uuid.uuid4()
        mock_user_msg.session_id = session_id
        mock_user_msg.role = "user"
        mock_user_msg.content = "I led a team through a difficult project."
        mock_user_msg.audio_url = None
        mock_user_msg.created_at = datetime(2024, 1, 1, 0, 0, 0)

        with patch.object(_router_mod, "get_session", return_value=mock_session), \
             patch.object(_router_mod, "create_message", return_value=mock_user_msg), \
             patch.object(_router_mod, "update_session", return_value=mock_session), \
             patch.object(_router_mod, "_load_session_history", return_value=[]), \
             patch.object(_router_mod, "get_interview_agent", return_value=mock_agent):
            response = client.post(
                f"/api/interview-agent/sessions/{session_id}/messages/stream",
                json={"content": "I led a team through a difficult project."},
                headers={"Authorization": "Bearer fake-token"},
            )

        # Should return streaming response
        assert response.status_code == 200
        assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


class TestSessionCompletion:
    """Test session completion and summary generation."""

    def test_complete_session(self, client, mock_user):
        """Test completing session and generating summary."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id
        mock_session.mode = "technical"
        mock_session.status = "in_progress"
        mock_session.target_role = "Backend Engineer"
        mock_session.question_count = 0
        mock_session.overall_score = None
        mock_session.overall_feedback = None
        mock_session.improvement_plan = None
        mock_session.created_at = "2024-01-01T00:00:00"
        mock_session.updated_at = "2024-01-01T00:00:00"

        mock_updated_session = MagicMock()
        mock_updated_session.id = session_id
        mock_updated_session.user_id = mock_user.id
        mock_updated_session.mode = "technical"
        mock_updated_session.status = "completed"
        mock_updated_session.target_role = "Backend Engineer"
        mock_updated_session.question_count = 5
        mock_updated_session.overall_score = 4.2
        mock_updated_session.overall_feedback = "Strong performance"
        mock_updated_session.improvement_plan = "1. Practice more\n2. Study more"
        mock_updated_session.created_at = "2024-01-01T00:00:00"
        mock_updated_session.updated_at = "2024-01-01T00:00:00"

        with patch.object(_router_mod, "get_session", return_value=mock_session), \
             patch.object(_router_mod, "update_session", return_value=mock_updated_session), \
             patch.object(_router_mod, "get_session_messages", return_value=[]), \
             patch.object(_router_mod, "generate_session_summary", return_value=MagicMock(
                 overall_score=4.2,
                 overall_feedback="Strong performance",
                 strengths=["Good technical depth"],
                 improvements=["Could quantify more"],
                 improvement_plan="1. Practice more\n2. Study more",
                 question_count=5,
             )):
            response = client.post(
                f"/api/interview-agent/sessions/{session_id}/complete",
                json={"force": False},
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["overall_score"] == 4.2
        assert "Strong performance" in data["overall_feedback"]
        assert len(data["strengths"]) > 0
        assert len(data["improvements"]) > 0
