"""add status/retry/source columns to alert_logs

Revision ID: 012
Revises: 011
Create Date: 2026-06-27

Adds delivery-status tracking (status, retry_count, last_retry_at,
error_message) and source attribution (source) to app.alert_logs so the
admin alerts page can surface failed emails and retry them, and show which
trigger source dispatched each alert.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "alert_logs",
        sa.Column("status", sa.String(length=20), server_default="sent", nullable=True),
        schema="app",
    )
    op.add_column(
        "alert_logs",
        sa.Column("retry_count", sa.Integer(), server_default="0", nullable=True),
        schema="app",
    )
    op.add_column(
        "alert_logs",
        sa.Column("last_retry_at", sa.DateTime(), nullable=True),
        schema="app",
    )
    op.add_column(
        "alert_logs",
        sa.Column("error_message", sa.String(length=500), nullable=True),
        schema="app",
    )
    op.add_column(
        "alert_logs",
        sa.Column("source", sa.String(length=50), nullable=True),
        schema="app",
    )


def downgrade() -> None:
    for col in ("source", "error_message", "last_retry_at", "retry_count", "status"):
        op.drop_column("alert_logs", col, schema="app")
