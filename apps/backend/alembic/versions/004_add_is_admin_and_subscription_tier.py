"""add is_admin and subscription_tier to users

Revision ID: 004
Revises: 003
Create Date: 2026-04-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default="false"),
        schema="app",
    )
    op.add_column(
        "users",
        sa.Column("subscription_tier", sa.String(20), nullable=False, server_default="free"),
        schema="app",
    )


def downgrade() -> None:
    op.drop_column("users", "subscription_tier", schema="app")
    op.drop_column("users", "is_admin", schema="app")
