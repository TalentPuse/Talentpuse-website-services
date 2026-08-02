"""view user_activity_daily: dung lai lich su hoat dong tu cac bang san co

Revision ID: 019
Revises: 018
Create Date: 2026-08-02

last_active_at (018) chi co du lieu tu ngay trien khai tro di. Neu chi dua vao
no thi moi duong cong retention deu bat dau tu 0 vao dung ngay deploy, va phai
doi vai thang moi noi duoc dieu gi that. View nay gop timestamp cua cac bang da
co nen retention lui duoc ve tan user dau tien.

alert_logs KHONG tinh la was_active: do la thu HE THONG GUI CHO user, khong
phai user chu dong dung san pham. Gop chung se thoi phong retention bang chinh
alert cua minh — cang gui nhieu alert thi so retention trong cang dep, trong
khi nguoi dung co the khong he mo mail. Vi vay no nam o cot rieng was_alerted;
cot do van can vi la mau so de tinh CTR cua alert.

Gom theo NGAY LICH VIET NAM (`AT TIME ZONE 'Asia/Ho_Chi_Minh'`) chu khong theo
ngay UTC. Gom theo UTC thi moi hoat dong tu 00:00-07:00 gio VN bi day nguoc ve
hom truoc — dung lop nguoi dung dung san pham buoi sang. Repo da ship dung loi
lech mui gio nay 3 lan (JA-25, JA-T1, JA-T2).

LECH SO VOI PLAN (kiem tra lai bang information_schema, plan doan sai ten cot):
  - interview_answers KHONG co `created_at`, cot thoi gian that la `answered_at`
  - cv_documents KHONG co `created_at`, chi co `updated_at`
Dung `updated_at` cho cv_documents la chap nhan duoc vi moi lan sua/tai CV len
deu la mot hanh dong that cua user; nhuoc diem la lan tai dau tien bi ghi de
neu sau nay sua lai, tuc la view co the DANH GIA THAP hoat dong cu — sai theo
huong an toan (khong bao gio thoi phong retention).

BAY QUAN TRONG NHAT O DAY — hai kieu cot khac nhau:
  cv_documents.updated_at   va  job_applications.created_at
la `timestamp WITHOUT time zone`, sau bang con lai la `timestamptz`.

Voi timestamptz, `ts AT TIME ZONE 'Asia/Ho_Chi_Minh'` CHUYEN DOI sang gio VN —
dung y muon. Voi timestamp naive thi cung cu phap ay lai DIEN GIAI gia tri do
NHU LA gio VN roi tra ve timestamptz — nguoc chieu hoan toan. Ap thang cong
thuc cua plan len hai cot naive se day chung lech 7 tieng, tuc la moi hoat dong
tu 17:00-24:00 UTC bi gan nham sang ngay hom sau, va lech IM LANG: view van
chay, van tra ve so, chi la so sai.

Hai cot naive do dang giu gio UTC (TimeZone cua server la Etc/UTC), nen phai
`AT TIME ZONE 'UTC'` truoc de bien chung thanh timestamptz that, roi moi doi
sang gio VN o buoc ngoai.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VN = "Asia/Ho_Chi_Minh"

CREATE_VIEW = f"""
CREATE OR REPLACE VIEW app.user_activity_daily AS
WITH events AS (
    SELECT user_id, created_at AS ts, TRUE  AS active FROM app.chat_rooms
    UNION ALL
    SELECT r.user_id, m.created_at,   TRUE
        FROM app.chat_messages m JOIN app.chat_rooms r ON r.id = m.room_id
    UNION ALL
    SELECT user_id, created_at,       TRUE  FROM app.interview_sessions
    UNION ALL
    SELECT s.user_id, a.answered_at,  TRUE
        FROM app.interview_answers a JOIN app.interview_sessions s ON s.id = a.session_id
    UNION ALL
    SELECT s.user_id, im.created_at,  TRUE
        FROM app.interview_messages im JOIN app.interview_sessions s ON s.id = im.session_id
    UNION ALL
    -- Hai nguon naive: `AT TIME ZONE 'UTC'` o day la doc "gia tri naive nay la
    -- gio UTC" -> tra ve timestamptz, dong bo kieu voi cac nhanh UNION khac.
    SELECT user_id, created_at AT TIME ZONE 'UTC', TRUE FROM app.job_applications
    UNION ALL
    SELECT user_id, updated_at AT TIME ZONE 'UTC', TRUE FROM app.cv_documents
    UNION ALL
    SELECT user_id, sent_at,          FALSE FROM app.alert_logs
)
SELECT
    user_id,
    DATE(ts AT TIME ZONE '{VN}')            AS activity_date,
    bool_or(active)                         AS was_active,
    bool_or(NOT active)                     AS was_alerted
FROM events
WHERE user_id IS NOT NULL
  AND ts IS NOT NULL
GROUP BY user_id, DATE(ts AT TIME ZONE '{VN}');
"""


def upgrade() -> None:
    op.execute(CREATE_VIEW)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS app.user_activity_daily")
