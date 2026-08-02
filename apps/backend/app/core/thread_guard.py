"""Kiem tra mot thread da co checkpoint hay chua, chiu duoc DB moi tinh.

Bang `public.checkpoints` KHONG do alembic tao. No do LangGraph tu tao khi
`AsyncPostgresSaver.setup()` chay lan dau (xem app/api/agui.py). Nghia la ton
tai mot khoang thoi gian — tu luc deploy den luc co nguoi dau tien dung tro ly
AI — ma bang do CHUA co.

Trong khoang do, cau `SELECT 1 FROM public.checkpoints ...` khong tra ve rong:
no NEM UndefinedTableError, va vi hai cho goi deu nam trong duong xu ly
request nen nguoi dung nhan 500. Cu the: tren mot moi truong moi dung,
`POST /api/chat/rooms` kem `id` do client sinh se 500 thay vi tao phong.
Day chinh la thu lam CI do (test_chat_rooms_api.py) tren Postgres sach — CI
chi la noi phoi bay ra truoc, khong phai nguyen nhan.

Khong dua bang nay vao migration cua app: no thuoc quyen so huu cua
LangGraph, tu dinh nghia lay se da nghia va co the va cham voi `setup()` khi
thu vien doi lieu do.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def thread_has_checkpoint(db: AsyncSession, thread_id: str) -> bool:
    """True neu thread da co checkpoint (tuc la hoi thoai da ton tai).

    Bang chua ton tai => chua the co checkpoint nao => False. Day khong phai
    lay le cho qua loi: khong co bang thi khong co dong nao, nen KHONG co
    thread mo coi de bao ve. Guard chong chiem doat thread van dung nguyen y
    nghia trong moi truong hop no thuc su can hoat dong.
    """
    co_bang = (
        await db.execute(text("SELECT to_regclass('public.checkpoints')"))
    ).scalar()
    if co_bang is None:
        return False

    row = await db.execute(
        text("SELECT 1 FROM public.checkpoints WHERE thread_id = :tid LIMIT 1"),
        {"tid": thread_id},
    )
    return row.first() is not None
