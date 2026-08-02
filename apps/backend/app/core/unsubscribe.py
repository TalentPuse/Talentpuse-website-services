"""Token huy nhan email — ky bang HMAC, khong can dang nhap (JA-22).

Vi sao khong dung JWT dang nhap: link huy nam trong email co the duoc bam sau
nhieu thang, tu mot thiet bi chua tung dang nhap. Token het han hoac doi hoi
phien dang nhap thi dan toi dung mot ket cuc: nguoi nhan khong huy duoc va bam
"Report spam" thay the.

Gmail va Yahoo BAT BUOC bulk sender phai co one-click unsubscribe (RFC 8058).
Thieu no, cong voi JA-10 (gui ca cho nguoi da huy), la duong ngan nhat de
`alerts@talentpuse.io.vn` bi xep vao spam cho TAT CA user — khong chi nguoi da
bam report.

Token khong het han CO CHU DICH: no chi cho phep TAT thong bao cua chinh
user_id do — khong doc duoc gi, khong bat lai duoc. Do la thao tac mot chieu va
vo hai; dat han su dung chi lam tang rui ro spam ma khong giam rui ro gi.
"""
from __future__ import annotations

import hashlib
import hmac

from app.core.config import JWT_SECRET

_DO_DAI_CHU_KY = 32


def _chu_ky(user_id: str) -> str:
    return hmac.new(
        JWT_SECRET.encode("utf-8"),
        f"email-unsubscribe:{user_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:_DO_DAI_CHU_KY]


def tao_token(user_id) -> str:
    uid = str(user_id)
    return f"{uid}.{_chu_ky(uid)}"


def doc_token(token: str) -> str | None:
    """Tra ve user_id neu chu ky hop le, nguoc lai None.

    `compare_digest` chu khong phai `==`: so sanh chuoi thong thuong thoat ra
    ngay tai byte dau tien khac nhau, de lo do dai tien to dung qua thoi gian
    phan hoi.
    """
    uid, _, sig = (token or "").rpartition(".")
    if not uid or not sig:
        return None
    return uid if hmac.compare_digest(sig, _chu_ky(uid)) else None
