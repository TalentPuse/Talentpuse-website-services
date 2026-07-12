"""add student profile fields

Revision ID: 006
Revises: 005
Create Date: 2026-05-02
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("university", sa.String(200), nullable=True),
        schema="app",
    )
    op.add_column(
        "users",
        sa.Column("graduation_year", sa.SmallInteger(), nullable=True),
        schema="app",
    )
    op.add_column(
        "users",
        sa.Column("open_to_internship", sa.Boolean(), server_default="false", nullable=False),
        schema="app",
    )
    op.add_column(
        "users",
        sa.Column("part_time_ok", sa.Boolean(), server_default="false", nullable=False),
        schema="app",
    )


def downgrade() -> None:
    op.drop_column("users", "part_time_ok", schema="app")
    op.drop_column("users", "open_to_internship", schema="app")
    op.drop_column("users", "graduation_year", schema="app")
    op.drop_column("users", "university", schema="app")
