"""alert_logs: them cot job_source + doi unique key + index sent_at

Revision ID: 017
Revises: 016
Create Date: 2026-08-02

Khoa thuc the cua warehouse la `(source, source_job_id)` — id chi duy nhat
TRONG MOT NGUON. Nhung `alert_logs` chi luu `source_job_id`, va unique
constraint la `(user_id, source_job_id, channel)`. Hai hau qua do duoc (JA-05):

(a) CHAN NHAM GIUA CAC NGUON. User da nhan alert job VietnamWorks `123`; sau do
    ITviec co job `123` hoan toan khac -> dedup loai vinh vien (alert_logs
    khong het han, va dedup phu thuoc vao viec khong bao gio xoa).

(b) CRASH SAU KHI DA GUI. Neu ca hai job cung lot vao mot batch,
    `_find_scored_jobs` tra ve ca hai (DISTINCT ON co xet `source`) ->
    `log_and_send` insert hai dong `(user, '123', 'website')` giong het nhau ->
    UniqueViolation NEM RA SAU KHI tin Telegram da bay di. Rollback xoa sach
    log, nen slot sau gui lai y het: nguoi dung nhan trung, con he thong thi
    khong biet minh da gui.

Cung goc re nay gay them JA-30 (my-alerts join nham job), JA-24 (retry lay nham
job), JA-48 (link sai nguon).

BACKFILL: du lieu cu khong biet nguon. Suy nguoc tu `fct_jobs_daily` theo
`source_job_id`; dong nao mo ho (id ton tai o >1 nguon) hoac khong tim thay thi
de NULL — doan bua o day se tao ra dedup sai theo huong nguy hiem hon (chan mot
job that su chua gui). NULL trong unique constraint cua Postgres duoc coi la
KHAC NHAU, nen cac dong cu de NULL khong con chan nhau; do la danh doi co chu
dich: tha gui trung mot lan con hon chan vinh vien.

Kem theo JA-36: them index tren `sent_at`. Moi query admin/user deu
sort/filter/group theo cot nay ma bang chi co index `(user_id, source_job_id)`.
"""
from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "alert_logs",
        sa.Column("job_source", sa.String(50), nullable=True),
        schema="app",
    )

    # Chi backfill khi id XAC DINH duy nhat mot nguon. `HAVING count(DISTINCT
    # source) = 1` chinh la cho chan viec doan bua.
    #
    # Gioi han `to_regclass` BAT BUOC: `dbt_dev_gold.fct_jobs_daily` la bang cua
    # kho du lieu, KHONG ton tai tren DB moi (CI, box moi, DB test). Backfill
    # khong dieu kien thi `alembic upgrade head` chet ngay voi "relation
    # dbt_dev_gold.fct_jobs_daily does not exist" — CI test job do -> deploy bi
    # chan -> box van chay image cu ma khong ai hay. Thieu bang thi khong co
    # gi de suy nguoc, de NULL (dung y nghia duoc ghi o docstring).
    conn = op.get_bind()
    co_bang_kho = conn.execute(
        sa.text("SELECT to_regclass('dbt_dev_gold.fct_jobs_daily') IS NOT NULL")
    ).scalar()
    if co_bang_kho:
        op.execute("""
            UPDATE app.alert_logs al
            SET job_source = m.source
            FROM (
                SELECT source_job_id, min(source) AS source
                FROM dbt_dev_gold.fct_jobs_daily
                GROUP BY source_job_id
                HAVING count(DISTINCT source) = 1
            ) m
            WHERE al.source_job_id = m.source_job_id
        """)

    op.drop_constraint(
        "uq_alert_log_user_job_channel", "alert_logs", schema="app", type_="unique"
    )
    op.create_unique_constraint(
        "uq_alert_log_user_source_job_channel",
        "alert_logs",
        ["user_id", "job_source", "source_job_id", "channel"],
        schema="app",
    )

    op.create_index(
        "ix_alert_logs_sent_at", "alert_logs", ["sent_at"], unique=False, schema="app"
    )


def downgrade() -> None:
    op.drop_index("ix_alert_logs_sent_at", table_name="alert_logs", schema="app")
    op.drop_constraint(
        "uq_alert_log_user_source_job_channel", "alert_logs", schema="app", type_="unique"
    )
    # Co the that bai neu trong luc chay ban moi da sinh ra hai dong chi khac
    # nhau o `job_source` — dung vay, do la du lieu ma rang buoc cu khong dien
    # ta duoc. Phai xu ly thu cong truoc khi ha cap.
    op.create_unique_constraint(
        "uq_alert_log_user_job_channel",
        "alert_logs",
        ["user_id", "source_job_id", "channel"],
        schema="app",
    )
    op.drop_column("alert_logs", "job_source", schema="app")
