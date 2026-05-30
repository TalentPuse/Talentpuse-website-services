"""Pydantic schemas for interview API.

All request and response models for the interview endpoints.
"""

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# =============================================================================
# Request Schemas
# =============================================================================


class SessionCreateRequest(BaseModel):
    """Request to create a new interview session."""

    mode: Literal["technical", "behavioral"] = Field(
        description="Interview mode: technical (system design, coding) or behavioral (STAR method)"
    )
    target_role: Optional[str] = Field(
        default=None,
        description="Target job role for the interview (e.g., 'Senior Backend Engineer')",
    )
    num_questions: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of questions to ask in this session",
    )


class MessageCreateRequest(BaseModel):
    """Request to send a message in an interview session."""

    content: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Message content from the user",
    )
    audio_url: Optional[str] = Field(
        default=None,
        description="Optional audio URL for voice input (future feature)",
    )


class SessionCompleteRequest(BaseModel):
    """Request to complete an interview session and generate summary."""

    force: bool = Field(
        default=False,
        description="Force completion even if question count not reached",
    )


# =============================================================================
# Response Schemas
# =============================================================================


class MessageResponse(BaseModel):
    """Response containing a single message."""

    id: UUID
    session_id: UUID
    role: Literal["user", "assistant"]
    content: str
    audio_url: Optional[str] = None  # Future: TTS audio for assistant messages
    created_at: datetime


class SessionResponse(BaseModel):
    """Response containing interview session data."""

    id: UUID
    user_id: UUID
    mode: Literal["technical", "behavioral"]
    status: Literal["created", "in_progress", "completed", "abandoned"]
    target_role: Optional[str] = None
    question_count: int = 0
    overall_score: Optional[float] = None
    overall_feedback: Optional[str] = None
    improvement_plan: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageResponse] = Field(default_factory=list)


class EvaluationResponse(BaseModel):
    """Response containing answer evaluation.

    Used for real-time feedback (optional feature).
    """

    score: float = Field(..., ge=1.0, le=5.0, description="Score from 1.0 to 5.0")
    feedback: str = Field(..., description="Narrative feedback")
    strengths: list[str] = Field(default_factory=list, description="Specific strengths")
    improvements: list[str] = Field(
        default_factory=list, description="Specific areas to improve"
    )
    suggested_answer: Optional[str] = Field(
        default=None, description="Suggested STAR/technical answer"
    )


class QuestionBreakdown(BaseModel):
    """Breakdown of a single question in session summary."""

    question: str = Field(..., description="The question asked")
    answer: str = Field(..., description="User's answer")
    score: float = Field(..., ge=1.0, le=5.0)
    category: Optional[str] = Field(default=None, description="Question category")


class SessionSummaryResponse(BaseModel):
    """Response containing session completion summary."""

    session_id: UUID
    mode: Literal["technical", "behavioral"]
    overall_score: float = Field(..., ge=1.0, le=5.0)
    overall_feedback: str = Field(..., description="Overall performance narrative")
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    improvement_plan: str = Field(..., description="Actionable improvement plan")
    question_count: int = Field(..., description="Number of questions exchanged")
    questions_breakdown: list[QuestionBreakdown] = Field(default_factory=list)


# =============================================================================
# SSE Event Schemas
# =============================================================================


class SSETokenEvent(BaseModel):
    """Server-Sent Event for streaming token."""

    type: Literal["token"] = "token"
    content: str = Field(..., description="Token content")


class SSEMessageEvent(BaseModel):
    """Server-Sent Event for complete message."""

    type: Literal["message"] = "message"
    message: MessageResponse = Field(..., description="Complete message data")


class SSEErrorEvent(BaseModel):
    """Server-Sent Event for error."""

    type: Literal["error"] = "error"
    error: str = Field(..., description="Error message")
    code: Optional[str] = Field(default=None, description="Error code")


class SESEndEvent(BaseModel):
    """Server-Sent Event for stream end."""

    type: Literal["done"] = "done"
    message: MessageResponse = Field(..., description="Final message data")


SSEEvent = SSETokenEvent | SSEMessageEvent | SSEErrorEvent | SESEndEvent


# =============================================================================
# Internal Schemas (not exposed to API)
# =============================================================================


class InterviewEvaluation(BaseModel):
    """Internal evaluation result from LLM."""

    score: float
    feedback: str
    strengths: list[str]
    improvements: list[str]
    suggested_answer: Optional[str] = None


class SessionSummary(BaseModel):
    """Internal session summary from LLM."""

    overall_score: float
    overall_feedback: str
    strengths: list[str]
    improvements: list[str]
    improvement_plan: str
    question_count: int
