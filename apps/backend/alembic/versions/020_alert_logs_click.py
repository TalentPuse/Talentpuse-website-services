"""alert_logs: them clicked_at + click_count de do CTR cua alert

Revision ID: 020
Revises: 019
Create Date: 2026-08-02

He thong dang do duoc "da gui bao nhieu alert" nhung khong biet co ai bam vao
khong. CTR la chi so manh nhat cho phan trinh bay: "alert dat X% CTR" thuyet
phuc hon nhieu so voi "da gui 10.000 alert".

`click_count` co `server_default='0'` va NOT NULL — khong phai nullable: sau nay
moi query CTR se lam `sum(click_count)` hoac `count(clicked_at)`, va mot cot
nullable bat moi cho goi phai nho `coalesce`. Quen mot lan la con so bao cao ra
ngoai bi sai.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "alert_logs",
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=True),
        schema="app",
    )
    op.add_column(
        "alert_logs",
        sa.Column("click_count", sa.Integer(), server_default="0", nullable=False),
        schema="app",
    )
    op.create_index(
        "ix_alert_logs_clicked_at", "alert_logs", ["clicked_at"], schema="app"
    )


def downgrade() -> None:
    op.drop_index("ix_alert_logs_clicked_at", table_name="alert_logs", schema="app")
    op.drop_column("alert_logs", "click_count", schema="app")
    op.drop_column("alert_logs", "clicked_at", schema="app")
