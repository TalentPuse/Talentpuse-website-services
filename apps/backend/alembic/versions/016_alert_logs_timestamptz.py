"""alert_logs.sent_at / last_retry_at -> timestamptz

Revision ID: 016
Revises: 015
Create Date: 2026-08-01

Hai cot nay dang la `timestamp WITHOUT time zone` nhung gia tri ben trong la gio
UTC (server_default `now()`, Postgres container chay TimeZone=UTC), trong khi
toan bo lich alert lai tinh theo gio Viet Nam (VN_TZ trong app/core/config.py).
Luu mot thoi diem ma khong kem mui gio la goc re cua ba loi do duoc:

1. FRONTEND HIEN LECH 7 TIENG. Pydantic serialize datetime naive thanh chuoi
   khong co hau to mui gio ("2026-08-01T12:30:00"), va JavaScript `new Date()`
   hieu chuoi ISO KHONG co mui gio la GIO DIA PHUONG. Nen alert gui luc 19:30 VN
   hien thanh 12:30 o admin/alerts/page.tsx:354 va AlertTimeline.tsx.

2. "ALERT HOM NAY" DEM SAI KHUNG. services/admin.py:35 lay nua dem gio VN roi
   `.replace(tzinfo=None)` — tuoc mui gio — va dem `sent_at >= :today`. So sanh
   nua-dem-VN voi du lieu UTC nghia la thuc te dem tu 07:00 sang gio VN.

3. GOM NHOM THEO NGAY BI LECH. `DATE(sent_at)` trong dispatch-history gom theo
   ngay UTC, nen alert tu 00:00-07:00 gio VN bi tinh sang ngay hom truoc.

Doi sang timestamptz thi Postgres luu mot thoi diem tuyet doi, Pydantic phat ra
"+00:00", JavaScript parse dung, va cac phep so sanh/gom nhom co the noi ro mui
gio muon quy chieu.

`USING col AT TIME ZONE 'UTC'` la buoc BAT BUOC: khong co no, Postgres se dien
giai gia tri naive theo TimeZone cua phien luc chay migration. Trung khop khi
phien la UTC, nhung se dich sai neu ai do chay migration tu may co TZ khac —
noi ro 'UTC' lam ket qua khong phu thuoc moi truong chay.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE app.alert_logs "
        "ALTER COLUMN sent_at TYPE timestamptz USING sent_at AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE app.alert_logs "
        "ALTER COLUMN last_retry_at TYPE timestamptz USING last_retry_at AT TIME ZONE 'UTC'"
    )


def downgrade() -> None:
    # Quy chieu nguoc ve UTC de tro lai dung gia tri naive ban dau.
    op.execute(
        "ALTER TABLE app.alert_logs "
        "ALTER COLUMN sent_at TYPE timestamp USING sent_at AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE app.alert_logs "
        "ALTER COLUMN last_retry_at TYPE timestamp USING last_retry_at AT TIME ZONE 'UTC'"
    )
