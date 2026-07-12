"""Evaluation services for interview sessions.

This module handles:
- Real-time answer evaluation (optional)
- End-of-session summary generation
- Score calculation and feedback generation
"""

from app.services.interview_agent.evaluation.evaluator import (
    evaluate_tech_answer,
    evaluate_behavioral_answer,
)
from app.services.interview_agent.evaluation.summarizer import (
    generate_session_summary,
)

__all__ = [
    "evaluate_tech_answer",
    "evaluate_behavioral_answer",
    "generate_session_summary",
]
