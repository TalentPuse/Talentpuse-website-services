"""Tests for interview API endpoints."""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app


def _make_user(**overrides):
    from app.models.user import User

    defaults = dict(
        id=uuid4(),
        email="test@example.com",
        hashed_password="$2b$12$fake",
        full_name="Test User",
        skills=["Python"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Ho Chi Minh"],
        desired_titles=["AI Engineer"],
        is_active=True,
        is_admin=False,
        subscription_tier="free",
        experience_level="senior",
        university=None,
        graduation_year=None,
        open_to_internship=False,
        part_time_ok=False,
        created_at=datetime(2026, 1, 15, 10, 0, 0),
        updated_at=datetime(2026, 1, 15, 10, 0, 0),
    )
    defaults.update(overrides)
    return MagicMock(spec=User, **defaults)


@pytest.fixture
def fake_user():
    return _make_user()


@pytest.fixture
def fake_db():
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def override_deps(fake_user, fake_db):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: fake_db
    yield
    app.dependency_overrides.clear()


SAMPLE_EVAL = {
    "score": 4.0,
    "strengths": "Good STAR structure",
    "improvements": "Add more metrics",
    "suggested_answer": "In project X...",
}


# ── Categories ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_categories(override_deps, fake_db):
    mock_result = MagicMock()
    mock_result.all.return_value = [("leadership", 6)]
    fake_db.execute.return_value = mock_result

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/interview/categories")

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["id"] == "leadership"
    assert data[0]["count"] == 6


# ── Create Session ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_practice_session(override_deps, fake_db):
    q1 = MagicMock()
    q1.id = uuid4()
    q1.text = "Test question"
    q1.category = "leadership"
    q1.difficulty = "medium"
    q1.answer_tips = "Some tips"
    q1.star_cues = {"situation": "S", "task": "T", "action": "A", "result": "R"}

    # First call: load questions; second call: load answers with question attrs
    a1 = MagicMock()
    a1.id = uuid4()
    a1.question_id = q1.id
    a1.order_index = 0
    a1.answer_text = None
    a1.score = None
    a1.strengths = None
    a1.improvements = None
    a1.suggested_answer = None
    a1.time_spent_seconds = None
    a1.skipped = False
    a1.answered_at = None

    q_result = MagicMock()
    q_result.scalars.return_value.all.return_value = [q1]

    a_result = MagicMock()
    a_result.scalars.return_value.all.return_value = [a1]

    fake_db.execute = AsyncMock(side_effect=[q_result, a_result])

    async def mock_refresh(obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid4()
        if not getattr(obj, "started_at", None):
            obj.started_at = datetime(2026, 5, 24, 10, 0, 0)
        if not getattr(obj, "created_at", None):
            obj.created_at = datetime(2026, 5, 24, 10, 0, 0)
        if getattr(obj, "completed_questions", None) is None:
            obj.completed_questions = 0
        if getattr(obj, "total_questions", None) is None:
            obj.total_questions = 1
        if getattr(obj, "status", None) is None:
            obj.status = "in_progress"
    fake_db.refresh.side_effect = mock_refresh

    async def mock_db_get(model, pk):
        if "Question" in str(model):
            return q1
        return None
    fake_db.get = AsyncMock(side_effect=mock_db_get)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/interview/sessions",
            json={"mode": "practice", "category": "leadership", "num_questions": 3},
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["mode"] == "practice"
    assert data["category"] == "leadership"
    assert data["total_questions"] == 1
    assert data["status"] == "in_progress"


@pytest.mark.asyncio
async def test_create_mock_test_session(override_deps, fake_db):
    q1 = MagicMock()
    q1.id = uuid4()
    q1.text = "Test question"
    q1.category = "teamwork"
    q1.difficulty = "easy"
    q1.answer_tips = None
    q1.star_cues = None

    a1 = MagicMock()
    a1.id = uuid4()
    a1.question_id = q1.id
    a1.order_index = 0
    a1.answer_text = None
    a1.score = None
    a1.strengths = None
    a1.improvements = None
    a1.suggested_answer = None
    a1.time_spent_seconds = None
    a1.skipped = False
    a1.answered_at = None

    q_result = MagicMock()
    q_result.scalars.return_value.all.return_value = [q1]

    a_result = MagicMock()
    a_result.scalars.return_value.all.return_value = [a1]

    fake_db.execute = AsyncMock(side_effect=[q_result, a_result])

    async def mock_refresh(obj):
        if not hasattr(obj, "id") or obj.id is None:
            obj.id = uuid4()
        if not getattr(obj, "started_at", None):
            obj.started_at = datetime(2026, 5, 24, 10, 0, 0)
        if not getattr(obj, "created_at", None):
            obj.created_at = datetime(2026, 5, 24, 10, 0, 0)
        if getattr(obj, "completed_questions", None) is None:
            obj.completed_questions = 0
        if getattr(obj, "total_questions", None) is None:
            obj.total_questions = 1
        if getattr(obj, "status", None) is None:
            obj.status = "in_progress"
    fake_db.refresh.side_effect = mock_refresh

    async def mock_db_get(model, pk):
        if "Question" in str(model):
            return q1
        return None
    fake_db.get = AsyncMock(side_effect=mock_db_get)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/interview/sessions",
            json={"mode": "mock_test", "target_role": "Backend Developer", "num_questions": 5, "time_limit_seconds": 180},
        )

    assert resp.status_code == 201
    data = resp.json()
    assert data["mode"] == "mock_test"
    assert data["target_role"] == "Backend Developer"
    assert data["time_limit_seconds"] == 180


# ── Submit Answer ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_submit_answer(override_deps, fake_user, fake_db):
    session_id = uuid4()
    answer_id = uuid4()
    question_id = uuid4()

    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.user_id = fake_user.id
    mock_session.status = "in_progress"
    mock_session.mode = "practice"
    mock_session.completed_questions = 0
    mock_session.total_questions = 3

    mock_question = MagicMock()
    mock_question.id = question_id
    mock_question.text = "Test question"
    mock_question.category = "leadership"
    mock_question.difficulty = "medium"
    mock_question.star_cues = None
    mock_question.evaluation_criteria = ["criteria1", "criteria2"]

    mock_answer = MagicMock()
    mock_answer.id = answer_id
    mock_answer.session_id = session_id
    mock_answer.question_id = question_id
    mock_answer.answered_at = None
    mock_answer.skipped = False

    async def mock_db_get(model, pk):
        if "Session" in str(model):
            return mock_session
        if "Answer" in str(model):
            return mock_answer
        if "Question" in str(model):
            return mock_question
        return None

    fake_db.get = AsyncMock(side_effect=mock_db_get)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/interview/sessions/{session_id}/answers/{answer_id}",
            json={"answer_text": "This is my test answer that is long enough to pass validation"},
        )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_submit_answer_too_short(override_deps, fake_user, fake_db):
    session_id = uuid4()

    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.user_id = fake_user.id
    mock_session.status = "in_progress"

    async def mock_db_get(model, pk):
        if "Session" in str(model):
            return mock_session
        return None

    fake_db.get = AsyncMock(side_effect=mock_db_get)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/interview/sessions/{session_id}/answers/{uuid4()}",
            json={"answer_text": "short"},
        )

    assert resp.status_code == 422  # Validation error


# ── Skip Answer ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_skip_answer_practice(override_deps, fake_user, fake_db):
    session_id = uuid4()
    answer_id = uuid4()

    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.user_id = fake_user.id
    mock_session.status = "in_progress"
    mock_session.mode = "practice"
    mock_session.completed_questions = 0
    mock_session.total_questions = 3

    mock_answer = MagicMock()
    mock_answer.id = answer_id
    mock_answer.session_id = session_id
    mock_answer.answered_at = None
    mock_answer.skipped = False

    async def mock_db_get(model, pk):
        if "Session" in str(model):
            return mock_session
        if "Answer" in str(model):
            return mock_answer
        return None

    fake_db.get = AsyncMock(side_effect=mock_db_get)
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    fake_db.execute.return_value = mock_result

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/interview/sessions/{session_id}/answers/{answer_id}/skip",
        )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_skip_answer_mock_test_forbidden(override_deps, fake_user, fake_db):
    session_id = uuid4()
    answer_id = uuid4()

    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.user_id = fake_user.id
    mock_session.status = "in_progress"
    mock_session.mode = "mock_test"

    async def mock_db_get(model, pk):
        if "Session" in str(model):
            return mock_session
        return None

    fake_db.get = AsyncMock(side_effect=mock_db_get)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            f"/api/interview/sessions/{session_id}/answers/{answer_id}/skip",
        )

    assert resp.status_code == 400


# ── Abandon Session ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_abandon_session(override_deps, fake_user, fake_db):
    session_id = uuid4()

    mock_session = MagicMock()
    mock_session.id = session_id
    mock_session.user_id = fake_user.id
    mock_session.status = "in_progress"

    fake_db.get = AsyncMock(return_value=mock_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.delete(f"/api/interview/sessions/{session_id}")

    assert resp.status_code == 204
    assert mock_session.status == "abandoned"


# ── Session Not Found ───────────────────────────────────────


@pytest.mark.asyncio
async def test_get_session_not_found(override_deps, fake_db):
    fake_db.get = AsyncMock(return_value=None)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/interview/sessions/{uuid4()}")

    assert resp.status_code == 404
