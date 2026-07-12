"""add telegram_connections and alert_subscriptions tables

Revision ID: 002
Revises: 001
Create Date: 2026-04-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "telegram_connections",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chat_id", sa.BigInteger, nullable=True),
        sa.Column("telegram_username", sa.String(255), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("link_code", sa.String(64), nullable=True),
        sa.Column("link_code_expires_at", sa.DateTime, nullable=True),
        sa.Column("linked_at", sa.DateTime, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        schema="app",
    )
    op.create_index("ix_tc_user_id", "telegram_connections", ["user_id"], unique=True, schema="app")
    op.create_index("ix_tc_chat_id", "telegram_connections", ["chat_id"], unique=True, schema="app")
    op.create_index("ix_tc_link_code", "telegram_connections", ["link_code"], unique=True, schema="app")

    op.create_table(
        "alert_subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_type", sa.String(50), nullable=False),
        sa.Column("enabled", sa.Boolean, server_default=sa.text("true"), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        schema="app",
    )
    op.create_index("ix_as_user_id", "alert_subscriptions", ["user_id"], schema="app")
    op.create_unique_constraint("uq_alert_sub_user_type", "alert_subscriptions", ["user_id", "alert_type"], schema="app")


def downgrade() -> None:
    op.drop_table("alert_subscriptions", schema="app")
    op.drop_table("telegram_connections", schema="app")
