"""add cv_file_url to users

Revision ID: 008
Revises: 007
Create Date: 2026-05-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("cv_file_url", sa.String(500), nullable=True),
        schema="app",
    )


def downgrade() -> None:
    op.drop_column("users", "cv_file_url", schema="app")
