"""add GIN index on app.jd_insight.data for B2/D1 P2"""

from alembic import op

revision = "024"
down_revision = "023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_jd_insight_data_gin ON app.jd_insight USING GIN (data jsonb_path_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS app.ix_jd_insight_data_gin")
