from typing import Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cv_documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("app.users.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("model_json", postgresql.JSONB, nullable=False),
        sa.Column("pdf_url", sa.String(500)),
        sa.Column("page_count", sa.Integer),
        sa.Column("tailored_for_jd", sa.String),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now()),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("cv_documents", schema="app")
