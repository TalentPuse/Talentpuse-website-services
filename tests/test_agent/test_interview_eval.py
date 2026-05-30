"""Tests for interview evaluation chain."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.agent.chains.interview_eval_chain import (
    _format_profile,
    evaluate_answer,
    generate_report,
)


def test_format_profile_full():
    profile = {
        "full_name": "Nguyen Van A",
        "desired_titles": ["AI Engineer", "Data Scientist"],
        "skills": ["Python", "SQL", "Docker"],
        "experience_level": "3 years",
    }
    result = _format_profile(profile)
    assert "Nguyen Van A" in result
    assert "AI Engineer" in result
    assert "Python" in result
    assert "3 years" in result


def test_format_profile_empty():
    result = _format_profile(None)
    assert result == "Khong co thong tin profile."


def test_format_profile_partial():
    profile = {"full_name": "Test"}
    result = _format_profile(profile)
    assert "Test" in result


@pytest.mark.asyncio
async def test_evaluate_answer_parses_json():
    mock_response = MagicMock()
    mock_response.content = '{"score": 4.5, "strengths": "Good structure", "improvements": "Add metrics", "suggested_answer": "In project X..."}'

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("app.services.agent.chains.interview_eval_chain._get_chain", return_value=mock_llm):
        result = await evaluate_answer(
            question_text="Tell me about a time...",
            category="leadership",
            difficulty="medium",
            star_cues={"situation": "S", "task": "T", "action": "A", "result": "R"},
            evaluation_criteria=["STAR structure", "Specific actions"],
            answer_text="In my previous role...",
            profile={"full_name": "Test", "skills": ["Python"]},
        )

    assert result["score"] == 4.5
    assert result["strengths"] == "Good structure"
    assert "Add metrics" in result["improvements"]


@pytest.mark.asyncio
async def test_evaluate_answer_wrapped_in_code_block():
    mock_response = MagicMock()
    mock_response.content = '```json\n{"score": 3.0, "strengths": "OK", "improvements": "Better", "suggested_answer": "..."}\n```'

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("app.services.agent.chains.interview_eval_chain._get_chain", return_value=mock_llm):
        result = await evaluate_answer(
            question_text="Test?",
            category="teamwork",
            difficulty="easy",
            star_cues=None,
            evaluation_criteria=["test"],
            answer_text="My answer",
        )

    assert result["score"] == 3.0


@pytest.mark.asyncio
async def test_evaluate_answer_invalid_json_fallback():
    mock_response = MagicMock()
    mock_response.content = "This is not valid JSON"

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("app.services.agent.chains.interview_eval_chain._get_chain", return_value=mock_llm):
        result = await evaluate_answer(
            question_text="Test?",
            category="teamwork",
            difficulty="easy",
            star_cues=None,
            evaluation_criteria=None,
            answer_text="My answer",
        )

    assert result["score"] == 3.0
    assert "Khong the parse" in result["strengths"]


@pytest.mark.asyncio
async def test_evaluate_answer_score_clamped():
    mock_response = MagicMock()
    mock_response.content = '{"score": 10.0, "strengths": "S", "improvements": "I", "suggested_answer": "A"}'

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("app.services.agent.chains.interview_eval_chain._get_chain", return_value=mock_llm):
        result = await evaluate_answer(
            question_text="Test?",
            category="teamwork",
            difficulty="easy",
            star_cues=None,
            evaluation_criteria=None,
            answer_text="My answer",
        )

    assert result["score"] == 5.0


@pytest.mark.asyncio
async def test_generate_report():
    mock_response = MagicMock()
    mock_response.content = '{"overall_score": 3.8, "overall_feedback": "Good overall", "improvement_plan": "Step 1...\\nStep 2...\\nStep 3..."}'

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("app.services.agent.chains.interview_eval_chain._get_chain", return_value=mock_llm):
        result = await generate_report(
            session_data={
                "target_role": "Backend Developer",
                "answers": [
                    {"category": "leadership", "score": 4.0, "strengths": "Good", "improvements": "Better"},
                    {"category": "teamwork", "score": 3.5, "strengths": "OK", "improvements": "More detail"},
                ],
            },
            profile={"full_name": "Test", "desired_titles": ["Backend Developer"]},
        )

    assert result["overall_score"] == 3.8
    assert "Good overall" in result["overall_feedback"]
    assert "Step 1" in result["improvement_plan"]


@pytest.mark.asyncio
async def test_generate_report_invalid_json():
    mock_response = MagicMock()
    mock_response.content = "Not JSON"

    mock_llm = MagicMock()
    mock_llm.ainvoke = AsyncMock(return_value=mock_response)

    with patch("app.services.agent.chains.interview_eval_chain._get_chain", return_value=mock_llm):
        result = await generate_report(
            session_data={"target_role": "Dev", "answers": []},
        )

    assert result["overall_score"] == 3.0
    assert "Khong the tao bao cao" in result["overall_feedback"]
