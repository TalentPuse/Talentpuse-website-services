"""Integration tests for interview agent API endpoints.

Tests that the API follows the same pattern as chat.py
"""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.security import get_current_user
from app.main import app


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
    """Create test client with mocked authentication."""
    async def override_get_current_user():
        return mock_user

    app.dependency_overrides[get_current_user] = override_get_current_user
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

        with patch(
            "app.services.interview_agent.api.interview_router.create_session",
            return_value=mock_session,
        ), patch(
            "app.services.interview_agent.api.interview_router.create_message",
            return_value=mock_message,
        ), patch(
            "app.services.interview_agent.api.interview_router.update_session",
            return_value=mock_session,
        ), patch(
            "app.services.interview_agent.api.interview_router.get_session_messages",
            return_value=[mock_message],
        ):
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
        assert "STAR" in data["messages"][0]["content"] or "phỏng vấn" in data["messages"][0]["content"]

    def test_list_sessions(self, client, mock_user):
        """Test listing user's interview sessions."""
        with patch(
            "app.services.interview_agent.storage.session_store.list_user_sessions",
            return_value=[],
        ):
            response = client.get(
                "/api/interview-agent/sessions",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_session_detail(self, client, mock_user):
        """Test getting session details with messages."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id
        mock_session.mode = "technical"
        mock_session.status = "in_progress"

        with patch(
            "app.services.interview_agent.storage.session_store.get_session",
            return_value=mock_session,
        ), patch(
            "app.services.interview_agent.storage.message_store.get_session_messages",
            return_value=[],
        ):
            response = client.get(
                f"/api/interview-agent/sessions/{session_id}",
                headers={"Authorization": "Bearer fake-token"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(session_id)

    def test_delete_session(self, client, mock_user):
        """Test deleting an interview session."""
        session_id = uuid.uuid4()

        mock_session = MagicMock()
        mock_session.id = session_id
        mock_session.user_id = mock_user.id

        with patch(
            "app.services.interview_agent.storage.session_store.get_session",
            return_value=mock_session,
        ):
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

        mock_agent = AsyncMock()
        mock_agent.ainvoke.return_value = {
            "messages": [
                MagicMock(content="User message"),
                MagicMock(content="That's a good approach!"),
            ]
        }

        with patch(
            "app.services.interview_agent.storage.session_store.get_session",
            return_value=mock_session,
        ), patch(
            "app.services.interview_agent.chains.get_interview_agent",
            return_value=mock_agent,
        ):
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

        with patch(
            "app.services.interview_agent.storage.session_store.get_session",
            return_value=mock_session,
        ), patch(
            "app.services.interview_agent.chains.get_interview_agent",
            return_value=mock_agent,
        ):
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

        with patch(
            "app.services.interview_agent.storage.session_store.get_session",
            return_value=mock_session,
        ), patch(
            "app.services.interview_agent.evaluation.summarizer.generate_session_summary",
            return_value=MagicMock(
                overall_score=4.2,
                overall_feedback="Strong performance",
                strengths=["Good technical depth"],
                improvements=["Could quantify more"],
                improvement_plan="1. Practice more\n2. Study more",
                question_count=5,
            ),
        ):
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
