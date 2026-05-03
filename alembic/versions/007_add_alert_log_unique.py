"""add unique constraint to alert_logs

Revision ID: 007
Revises: 006
Create Date: 2026-05-03
"""
from typing import Sequence, Union

from alembic import op


revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_alert_log_user_job_channel",
        "alert_logs",
        ["user_id", "source_job_id", "channel"],
        schema="app",
    )


def downgrade() -> None:
    op.drop_constraint("uq_alert_log_user_job_channel", "alert_logs", schema="app")
