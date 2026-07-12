"""add interview tables

Revision ID: 010
Revises: 009
Create Date: 2026-05-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "interview_questions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("difficulty", sa.String(10), server_default="medium"),
        sa.Column("answer_tips", sa.Text, nullable=True),
        sa.Column("star_cues", sa.dialects.postgresql.JSONB, nullable=True),
        sa.Column("evaluation_criteria", sa.dialects.postgresql.JSONB, nullable=False),
        sa.Column("sample_answer", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index(
        "ix_interview_questions_category",
        "interview_questions", ["category", "is_active"],
        schema="app",
    )

    op.create_table(
        "interview_sessions",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("mode", sa.String(10), nullable=False),
        sa.Column("status", sa.String(15), server_default="in_progress"),
        sa.Column("category", sa.String(30), nullable=True),
        sa.Column("target_role", sa.String(100), nullable=True),
        sa.Column("total_questions", sa.SmallInteger, server_default="0"),
        sa.Column("completed_questions", sa.SmallInteger, server_default="0"),
        sa.Column("overall_score", sa.Float, nullable=True),
        sa.Column("overall_feedback", sa.Text, nullable=True),
        sa.Column("improvement_plan", sa.Text, nullable=True),
        sa.Column("time_limit_seconds", sa.SmallInteger, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index(
        "ix_interview_sessions_user_id",
        "interview_sessions", ["user_id", "created_at"],
        schema="app",
    )

    op.create_table(
        "interview_answers",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.interview_questions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("order_index", sa.SmallInteger, nullable=False),
        sa.Column("answer_text", sa.Text, nullable=True),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("strengths", sa.Text, nullable=True),
        sa.Column("improvements", sa.Text, nullable=True),
        sa.Column("suggested_answer", sa.Text, nullable=True),
        sa.Column("evaluation_raw", sa.dialects.postgresql.JSONB, nullable=True),
        sa.Column("time_spent_seconds", sa.SmallInteger, nullable=True),
        sa.Column("answered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("skipped", sa.Boolean, server_default="false"),
        schema="app",
    )
    op.create_index(
        "ix_interview_answers_session",
        "interview_answers", ["session_id", "order_index"],
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("interview_answers", schema="app")
    op.drop_table("interview_sessions", schema="app")
    op.drop_table("interview_questions", schema="app")
