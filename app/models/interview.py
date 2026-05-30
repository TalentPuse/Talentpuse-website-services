from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    difficulty: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="medium"
    )
    answer_tips: Mapped[str | None] = mapped_column(Text, nullable=True)
    star_cues: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    evaluation_criteria: Mapped[list] = mapped_column(JSONB, nullable=False)
    sample_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.users.id", ondelete="CASCADE"),
        nullable=False,
    )
    mode: Mapped[str] = mapped_column(String(20), nullable=False)  # "technical" or "behavioral"
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="created"
    )  # "created", "in_progress", "completed", "abandoned"
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    target_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_questions: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="5"
    )
    question_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )  # Number of questions exchanged (user messages)
    completed_questions: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="0"
    )
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    improvement_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    time_limit_seconds: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    started_at: Mapped[datetime] = mapped_column(server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class InterviewAnswer(Base):
    __tablename__ = "interview_answers"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.interview_questions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    order_index: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    improvements: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    evaluation_raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    time_spent_seconds: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    answered_at: Mapped[datetime | None] = mapped_column(nullable=True)
    skipped: Mapped[bool] = mapped_column(Boolean, server_default="false")


class InterviewMessage(Base):
    """Chat message for conversational interview sessions.

    Supports the new chat-based interview approach where:
    - User and AI have back-and-forth conversations
    - AI can ask follow-up questions
    - Messages stream via SSE
    - Optional audio URLs for voice features
    """

    __tablename__ = "interview_messages"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("app.interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" or "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )  # TTS audio for assistant messages (future)
    original_audio_url: Mapped[str | None] = mapped_column(
        String(512), nullable=True
    )  # STT audio for user messages (future)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
