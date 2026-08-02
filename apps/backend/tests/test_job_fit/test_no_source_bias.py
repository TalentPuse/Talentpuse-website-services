"""Diem so KHONG duoc lech theo nha cung cap tin.

silver_skill_long phu 100% itviec, 99% vietnamworks, 53% topcv, va 0% linkedin
(0/4130 tin). Neu engine chi cham diem ky nang tu bang do thi toan bo 64% kho la
tin LinkedIn se tut day bang xep hang — khong phai vi khong hop ma vi ETL chua
trich ky nang cho nguon do. Test nay la hang rao chan dieu do quay lai.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core import database as db_module
from app.models.user import User
from app.services.job_fit import score_jobs

NGUONG_LECH = 15  # diem trung binh giua nguon cao nhat va thap nhat
MAU_MOI_NGUON = 20


def _user() -> User:
    return User(
        skills=["python", "sql", "java", "react", "aws", "docker",
                "project management", "marketing", "sales", "accounting"],
        desired_titles=[], preferred_cities=[],
        desired_salary_min=None, desired_salary_max=None,
        experience_level=None,
    )


@pytest.mark.asyncio
async def test_diem_trung_binh_khong_lech_theo_nguon(warehouse):
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        keys: list[tuple[str, str]] = []
        for src in ("linkedin", "vietnamworks", "itviec", "topcv"):
            rows = (await db.execute(text("""
                -- DISTINCT ON BAT BUOC: fct_jobs_daily la bang snapshot hang ngay,
                -- mot tin co nhieu dong is_active (6432 dong = 3056 tin phan biet).
                -- Khong khu trung thi 20 dong mau co the chi la 6 tin that, va
                -- trung binh diem cua nguon do bi mot vai tin chi phoi — dung
                -- nhu lan chay dau: vietnamworks ra 0.0 va bao dong gia.
                SELECT DISTINCT ON (source, source_job_id) source, source_job_id
                FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active AND source = :s
                ORDER BY source, source_job_id, snapshot_date DESC
                LIMIT :n
            """), {"s": src, "n": MAU_MOI_NGUON})).all()
            keys += [(r[0], r[1]) for r in rows]

        if len(keys) < MAU_MOI_NGUON * 2:
            pytest.skip("kho du lieu local khong du mau")

        scored = await score_jobs(db, _user(), keys)

    theo_nguon: dict[str, list[int]] = {}
    for (src, _), fit in scored.items():
        theo_nguon.setdefault(src, []).append(fit.score)

    trung_binh = {s: sum(v) / len(v) for s, v in theo_nguon.items() if len(v) >= 5}
    assert len(trung_binh) >= 2, f"can it nhat 2 nguon co du mau: {theo_nguon.keys()}"

    lech = max(trung_binh.values()) - min(trung_binh.values())
    assert lech <= NGUONG_LECH, (
        f"diem lech {lech:.1f} qua {NGUONG_LECH} giua cac nguon: "
        f"{ {k: round(v, 1) for k, v in trung_binh.items()} } — "
        "gan nhu chac chan la engine dang chi doc silver_skill_long"
    )


@pytest.mark.asyncio
async def test_tin_linkedin_van_co_diem_ky_nang(warehouse):
    """LinkedIn khong co dong nao trong silver_skill_long, nen neu tin LinkedIn
    nao cung co skill_basis='none' thi nhanh quet JD text da hong."""
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        rows = (await db.execute(text("""
            SELECT DISTINCT ON (source, source_job_id) source, source_job_id
            FROM dbt_dev_gold.fct_jobs_daily
            WHERE is_active AND source = 'linkedin'
            ORDER BY source, source_job_id, snapshot_date DESC
            LIMIT 30
        """))).all()
        if not rows:
            pytest.skip("khong co tin linkedin trong kho local")
        scored = await score_jobs(db, _user(), [(r[0], r[1]) for r in rows])

    assert scored, "khong cham duoc tin linkedin nao"
    co_ky_nang = [f for f in scored.values() if f.skills_matched > 0]
    assert co_ky_nang, "khong tin LinkedIn nao khop ky nang — nhanh quet JD text hong"
