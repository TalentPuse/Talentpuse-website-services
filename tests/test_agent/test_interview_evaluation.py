"""Unit tests for interview agent evaluation and summarization.

Tests LLM-based evaluation and summary generation.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
class TestTechEvaluation:
    """Test technical interview answer evaluation."""

    async def test_evaluate_tech_answer_success(self):
        """Test successful evaluation of technical answer."""
        from app.services.interview_agent.evaluation.evaluator import (
            evaluate_tech_answer,
        )

        mock_response = MagicMock()
        mock_response.content = '''```json
{
  "score": 4.2,
  "feedback": "Good approach to distributed systems.",
  "strengths": ["Mentioned Redis for caching", "Considered scalability"],
  "improvements": ["Could mention specific technologies"],
  "suggested_answer": "You could also consider..."
}
```'''

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = mock_response

        with patch(
            "app.services.interview_agent.evaluation.evaluator.create_llm",
            return_value=mock_llm,
        ):
            result = await evaluate_tech_answer(
                question="Design a URL shortener",
                answer="I'd use Redis to store mappings...",
                profile={"skills": ["Redis", "Python"], "experience_level": "senior"},
                target_role="Backend Engineer",
            )

        assert result["score"] == 4.2
        assert "Good approach" in result["feedback"]
        assert len(result["strengths"]) > 0
        assert len(result["improvements"]) > 0

    async def test_evaluate_tech_answer_fallback_on_error(self):
        """Test that evaluation returns fallback on parsing error."""
        from app.services.interview_agent.evaluation.evaluator import (
            evaluate_tech_answer,
        )

        mock_response = MagicMock()
        mock_response.content = "Invalid JSON response"

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = mock_response

        with patch(
            "app.services.interview_agent.evaluation.evaluator.create_llm",
            return_value=mock_llm,
        ):
            result = await evaluate_tech_answer(
                question="Design a system",
                answer="My answer",
                profile={},
            )

        # Should return fallback with default score
        assert result["score"] == 3.0
        assert "Unable to parse" in result["feedback"] or "error" in result["feedback"]

    async def test_evaluate_tech_answer_score_bounds(self):
        """Test that scores are clamped between 1.0 and 5.0."""
        from app.services.interview_agent.evaluation.evaluator import (
            evaluate_tech_answer,
        )

        # Test with high score
        mock_response = MagicMock()
        mock_response.content = '{"score": 10.0, "feedback": "Test"}'

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = mock_response

        with patch(
            "app.services.interview_agent.evaluation.evaluator.create_llm",
            return_value=mock_llm,
        ):
            result = await evaluate_tech_answer(
                question="Q", answer="A", profile={}
            )

        assert result["score"] == 5.0  # Clamped to max

        # Test with low score
        mock_response.content = '{"score": 0.0, "feedback": "Test"}'
        mock_llm.ainvoke.return_value = mock_response

        with patch(
            "app.services.interview_agent.evaluation.evaluator.create_llm",
            return_value=mock_llm,
        ):
            result = await evaluate_tech_answer(
                question="Q", answer="A", profile={}
            )

        assert result["score"] == 1.0  # Clamped to min


@pytest.mark.asyncio
class TestBehavioralEvaluation:
    """Test behavioral interview answer evaluation."""

    async def test_evaluate_behavioral_answer_success(self):
        """Test successful evaluation of behavioral answer."""
        from app.services.interview_agent.evaluation.evaluator import (
            evaluate_behavioral_answer,
        )

        mock_response = MagicMock()
        mock_response.content = '''```json
{
  "score": 3.8,
  "feedback": "Good STAR structure! Your Result could be more quantified.",
  "strengths": ["Situation clearly described", "Action well-explained"],
  "improvements": ["Result could be more quantified"],
  "suggested_answer": "In my previous role..."
}
```'''

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = mock_response

        with patch(
            "app.services.interview_agent.evaluation.evaluator.create_llm",
            return_value=mock_llm,
        ):
            result = await evaluate_behavioral_answer(
                question="Tell me about a time you led a team",
                answer="In my previous role, our team...",
                star_cues={
                    "situation": "Context...",
                    "task": "Goal...",
                    "action": "Steps...",
                    "result": "Outcome...",
                },
                profile={"skills": ["Leadership"], "experience_level": "mid"},
            )

        assert result["score"] == 3.8
        assert "STAR" in result["feedback"]
        assert len(result["strengths"]) > 0
        assert len(result["improvements"]) > 0

    async def test_evaluate_behavioral_answer_fallback(self):
        """Test that behavioral evaluation returns fallback on error."""
        from app.services.interview_agent.evaluation.evaluator import (
            evaluate_behavioral_answer,
        )

        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = Exception("LLM API error")

        with patch(
            "app.services.interview_agent.evaluation.evaluator.create_llm",
            return_value=mock_llm,
        ):
            result = await evaluate_behavioral_answer(
                question="Question", answer="Answer", star_cues={}, profile={}
            )

        assert result["score"] == 3.0
        assert "Unable to evaluate" in result["feedback"]


@pytest.mark.asyncio
class TestSessionSummarizer:
    """Test session summary generation."""

    async def test_generate_session_summary_success(self):
        """Test successful generation of session summary."""
        from app.services.interview_agent.evaluation.summarizer import (
            generate_session_summary,
        )

        mock_response = MagicMock()
        mock_response.content = '''```json
{
  "overall_score": 4.1,
  "overall_feedback": "Overall strong performance in technical depth.",
  "strengths": ["Strong system design", "Clear communication"],
  "improvements": ["Could quantify outcomes more"],
  "improvement_plan": "1. Study distributed systems patterns\\n2. Practice quantifying impact\\n3. Work on STAR method",
  "question_count": 5
}
```'''

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = mock_response

        with patch(
            "app.services.interview_agent.evaluation.summarizer.create_llm",
            return_value=mock_llm,
        ):
            messages = [
                {"role": "assistant", "content": "Design a URL shortener"},
                {"role": "user", "content": "I'd use Redis..."},
                {"role": "assistant", "content": "Good approach! What about..."},
                {"role": "user", "content": "I'd add..."},
            ]

            result = await generate_session_summary(
                mode="technical",
                messages=messages,
                profile={"skills": ["Python", "Redis"], "experience_level": "senior"},
                target_role="Backend Engineer",
                evaluations=None,
            )

        assert result["overall_score"] == 4.1
        assert "strong performance" in result["overall_feedback"].lower()
        assert len(result["strengths"]) > 0
        assert len(result["improvements"]) > 0
        assert result["question_count"] == 5

    async def test_generate_summary_includes_profile(self):
        """Test that summary generation includes user profile in prompt."""
        from app.services.interview_agent.evaluation.summarizer import (
            generate_session_summary,
        )

        mock_llm = AsyncMock()
        mock_llm.ainvoke.return_value = MagicMock(
            content='{"overall_score": 3.5, "overall_feedback": "Test", "strengths": [], "improvements": [], "improvement_plan": "Test", "question_count": 3}'
        )

        with patch(
            "app.services.interview_agent.evaluation.summarizer.create_llm",
            return_value=mock_llm,
        ) as mock_create:
            await generate_session_summary(
                mode="behavioral",
                messages=[],
                profile={
                    "full_name": "John Doe",
                    "skills": ["Python", "JavaScript"],
                    "desired_titles": ["Backend Engineer"],
                },
                target_role="Software Engineer",
            )

            # Verify LLM was called
            assert mock_llm.ainvoke.called
            call_args = mock_llm.ainvoke.call_args[0][0]
            prompt = call_args.content

            # Check that profile info is in prompt
            assert "John Doe" in prompt or "Python" in prompt

    async def test_generate_summary_fallback(self):
        """Test that summary generation returns fallback on error."""
        from app.services.interview_agent.evaluation.summarizer import (
            generate_session_summary,
        )

        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = Exception("API error")

        with patch(
            "app.services.interview_agent.evaluation.summarizer.create_llm",
            return_value=mock_llm,
        ):
            result = await generate_session_summary(
                mode="technical",
                messages=[],
                profile={},
            )

        assert result["overall_score"] == 3.0
        assert "Unable to generate" in result["overall_feedback"]
