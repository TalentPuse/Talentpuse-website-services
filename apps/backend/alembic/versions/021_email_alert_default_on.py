"""alert_subscriptions: bat email alert MAC DINH cho user da ton tai

Revision ID: 021
Revises: 020
Create Date: 2026-08-07

Quyet dinh san pham 2026-08-07: email alert ON mac dinh tu luc dang ky (xem
app/services/auth.py). User da ton tai truoc do khong co dong subscription nao
nen khong bao gio nhan email — backfill tao dong enabled=true.

CHI tao cho user CHUA CO dong `email_job_match` nao: user da chu dong
unsubscribe (dong enabled=false) phai duoc giu nguyen — khong duoc bam lai nguoi
da huy (JA-10/JA-22).
"""
from alembic import op
import sqlalchemy as sa

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO app.alert_subscriptions (id, user_id, alert_type, enabled)
        SELECT gen_random_uuid(), u.id, 'email_job_match', true
        FROM app.users u
        WHERE NOT EXISTS (
            SELECT 1 FROM app.alert_subscriptions s
            WHERE s.user_id = u.id AND s.alert_type = 'email_job_match'
        )
    """)


def downgrade() -> None:
    # Khong xoa: khong the phan biet dong do backfill tao voi dong user tu bat.
    pass
