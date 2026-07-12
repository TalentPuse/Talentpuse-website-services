"""job_applications table

Revision ID: 015
Revises: 014
"""
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_applications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("app.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("source_job_id", sa.String(), nullable=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("company_name", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("source_url", sa.String(), nullable=True),
        sa.Column("salary_million", sa.Float(), nullable=True),
        sa.Column("status", sa.String(20), server_default="applied", nullable=False),
        sa.Column("applied_at", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        schema="app",
    )
    op.create_index("ix_job_applications_user_id", "job_applications", ["user_id"], schema="app")
    op.create_index("ix_job_app_user_status", "job_applications", ["user_id", "status"], schema="app")
    op.create_index(
        "uq_job_app_user_job", "job_applications",
        ["user_id", "source", "source_job_id"], unique=True,
        schema="app", postgresql_where=sa.text("source_job_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_table("job_applications", schema="app")
