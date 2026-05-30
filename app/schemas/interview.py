from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# ── Categories ──────────────────────────────────────────────


class CategoryOut(BaseModel):
    id: str
    label: str
    label_vi: str
    description: str
    count: int


# ── Questions ───────────────────────────────────────────────


class QuestionOut(BaseModel):
    id: str
    text: str
    category: str
    difficulty: str
    answer_tips: str | None = None
    star_cues: dict | None = None


# ── Sessions ────────────────────────────────────────────────


class SessionCreate(BaseModel):
    mode: Literal["practice", "mock_test"]
    category: str | None = None
    target_role: str | None = None
    num_questions: int = Field(default=5, ge=1, le=20)
    time_limit_seconds: int | None = Field(default=None, ge=30, le=600)


class SessionOut(BaseModel):
    id: str
    mode: str
    status: str
    category: str | None = None
    target_role: str | None = None
    total_questions: int
    completed_questions: int
    overall_score: float | None = None
    overall_feedback: str | None = None
    improvement_plan: str | None = None
    time_limit_seconds: int | None = None
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime


class SessionAnswerOut(BaseModel):
    id: str
    question: QuestionOut
    order_index: int
    answer_text: str | None = None
    score: float | None = None
    strengths: str | None = None
    improvements: str | None = None
    suggested_answer: str | None = None
    time_spent_seconds: int | None = None
    skipped: bool = False
    answered_at: datetime | None = None


class SessionDetailOut(SessionOut):
    answers: list[SessionAnswerOut] = []


# ── Answer submission ───────────────────────────────────────


class AnswerSubmit(BaseModel):
    answer_text: str = Field(min_length=10)
    time_spent_seconds: int | None = None


class EvaluationOut(BaseModel):
    answer_id: str
    score: float
    strengths: str
    improvements: str
    suggested_answer: str


# ── Report ──────────────────────────────────────────────────


class QuestionBreakdown(BaseModel):
    question_text: str
    category: str
    score: float | None = None
    strengths: str | None = None
    improvements: str | None = None
    suggested_answer: str | None = None
    time_spent_seconds: int | None = None


class MockTestReportOut(BaseModel):
    session: SessionOut
    questions: list[QuestionBreakdown]
    overall_score: float
    overall_feedback: str
    improvement_plan: str
