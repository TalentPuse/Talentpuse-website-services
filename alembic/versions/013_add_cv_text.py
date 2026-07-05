"""add cv_text to users

Revision ID: 013
Revises: 012
Create Date: 2026-07-05

Stores the extracted plain text of a user's uploaded CV so downstream AI
features (skill-advisor / interview coach / future CopilotKit copilot) can read
the actual CV content, not just the profile fields. Mirrors cv_file_url (008):
one CV per user, overwritten on each upload.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("cv_text", sa.Text(), nullable=True),
        schema="app",
    )


def downgrade() -> None:
    op.drop_column("users", "cv_text", schema="app")
