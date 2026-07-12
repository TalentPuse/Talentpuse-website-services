"""add desired_titles to users and alert_logs table

Revision ID: 003
Revises: 002
Create Date: 2026-04-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("desired_titles", sa.ARRAY(sa.String), server_default="{}"),
        schema="app",
    )

    op.create_table(
        "alert_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_job_id", sa.String, nullable=False),
        sa.Column("sent_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("channel", sa.String(20), server_default="telegram"),
        schema="app",
    )
    op.create_index("ix_al_user_job", "alert_logs", ["user_id", "source_job_id"], schema="app")


def downgrade() -> None:
    op.drop_table("alert_logs", schema="app")
    op.drop_column("users", "desired_titles", schema="app")
