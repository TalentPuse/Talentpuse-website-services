"""Add interview_messages table and update interview_sessions

Revision ID: 011
Revises: 010
Create Date: 2026-05-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update interview_sessions table
    with op.batch_alter_table("interview_sessions", schema="app") as batch_op:
        # Change mode column to support longer values ("technical", "behavioral")
        batch_op.alter_column(
            "mode",
            existing_type=sa.String(10),
            type_=sa.String(20),
            existing_nullable=False,
        )
        # Change status column to support more values and default to "created"
        batch_op.alter_column(
            "status",
            existing_type=sa.String(15),
            type_=sa.String(20),
            existing_server_default="in_progress",
            server_default="created",
            existing_nullable=False,
        )
        # Change target_role to support longer values
        batch_op.alter_column(
            "target_role",
            existing_type=sa.String(100),
            type_=sa.String(255),
            existing_nullable=True,
        )
        # Change total_questions default to 5
        batch_op.alter_column(
            "total_questions",
            existing_type=sa.SmallInteger,
            existing_server_default="0",
            server_default="5",
            existing_nullable=False,
        )
        # Add question_count column (number of questions exchanged)
        batch_op.add_column(
            sa.Column(
                "question_count",
                sa.SmallInteger,
                server_default="0",
                nullable=False,
            )
        )
        # Add updated_at column with auto-update
        batch_op.add_column(
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            )
        )

    # Create interview_messages table
    op.create_table(
        "interview_messages",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("session_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.interview_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),  # "user" or "assistant"
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("audio_url", sa.String(512), nullable=True),  # TTS audio for assistant (future)
        sa.Column("original_audio_url", sa.String(512), nullable=True),  # STT audio for user (future)
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index(
        "ix_interview_messages_session_id",
        "interview_messages", ["session_id"],
        schema="app",
    )
    op.create_index(
        "ix_interview_messages_created_at",
        "interview_messages", ["created_at"],
        schema="app",
    )


def downgrade() -> None:
    # Drop interview_messages table
    op.drop_index("ix_interview_messages_created_at", table_name="interview_messages", schema="app")
    op.drop_index("ix_interview_messages_session_id", table_name="interview_messages", schema="app")
    op.drop_table("interview_messages", schema="app")

    # Revert interview_sessions changes
    with op.batch_alter_table("interview_sessions", schema="app") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("question_count")
        batch_op.alter_column(
            "total_questions",
            existing_type=sa.SmallInteger,
            existing_server_default="5",
            server_default="0",
            existing_nullable=False,
        )
        batch_op.alter_column(
            "target_role",
            existing_type=sa.String(255),
            type_=sa.String(100),
            existing_nullable=True,
        )
        batch_op.alter_column(
            "status",
            existing_type=sa.String(20),
            existing_server_default="created",
            server_default="in_progress",
            existing_nullable=False,
        )
        batch_op.alter_column(
            "mode",
            existing_type=sa.String(20),
            type_=sa.String(10),
            existing_nullable=False,
        )
