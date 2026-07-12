"""add chat_rooms and chat_messages tables

Revision ID: 009
Revises: 008
Create Date: 2026-05-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_rooms",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index("ix_chat_rooms_user_id", "chat_rooms",
                    ["user_id", "updated_at"], schema="app")

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("room_id", sa.dialects.postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.chat_rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        schema="app",
    )
    op.create_index("ix_chat_messages_room_id", "chat_messages",
                    ["room_id", "created_at"], schema="app")


def downgrade() -> None:
    op.drop_table("chat_messages", schema="app")
    op.drop_table("chat_rooms", schema="app")
