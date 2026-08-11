"""JA-60 — loai bo job "chi khop thanh pho" khoi alert + skill word-boundary.

Truoc khi sua, `WHERE score > 0` cho phep mot job khong trung title, khong
trung skill nao (chi khop city_canonical, 25/100 diem) van duoc alert. Con
fallback skill dung `%ai%` lam "ai" trong "KHAI" / "Sustainability" match
nham. Spec: 2026-08-11-alert-match-quality-design.md.
"""
from __future__ import annotations

import re
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.models.user import User
from app.services.job_matcher import JobMatcher


def _sql_pg(stmt) -> str:
    return str(stmt.compile(dialect=postgresql.dialect()))


def _fake_db(captured: dict):
    class FakeDB:
        async def execute(self, sql, params=None):
            compiled = sql.compile(dialect=postgresql.dialect())
            captured.setdefault("sqls", []).append(str(compiled))
            captured.setdefault("params", []).append(dict(compiled.params))

            class R:
                def all(self):
                    return []

            return R()

        def add(self, obj):
            pass

        async def flush(self):
            pass

    return FakeDB()


def _user(**kwargs) -> User:
    u = MagicMock(spec=User)
    u.id = "00000000-0000-0000-0000-000000000001"
    u.skills = []
    u.desired_titles = []
    u.preferred_cities = []
    u.desired_salary_min = None
    u.experience_level = None
    for k, v in kwargs.items():
        setattr(u, k, v)
    return u


# ─── Cổng: title HOẶC skill phải > 0 ────────────────────────────────


@pytest.mark.asyncio
async def test_cong_loai_job_chi_khop_thanh_pho():
    """Job chi khop city (title=0, skill=0) khong duoc vao danh sach alert.

    `WHERE score > 0` cu: GRAPHIC DESIGNER / TECHNICAL SUPPORT HOA POLYMER /
    Telesale cho user 23520123@gm.uit.edu.vn chi co city_score=25 van duoc
    alert. Thay bang cong `title_score > 0 OR skill_score > 0`.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(
        _user(
            experience_level="fresher",
            desired_titles=["Python Engineer"],
            skills=["python"],
            preferred_cities=["Hồ Chí Minh"],
        )
    )

    sql = captured["sqls"][-1]
    # SQLAlchemy dua `0` vao bind param nen khong the so chuoi `> 0`; gioi han
    # so cau truc: cong phai la OR giua hai thanh phan title_score/skill_score.
    assert re.search(
        r"scored\.title_score > .*? OR scored\.skill_score >",
        sql,
        re.IGNORECASE | re.DOTALL,
    ), f"van con `score > 0`? Job chi khop city van lo lot:\n{sql}"
    assert "scored.score >" not in sql, "van dung cong cu tren score tong"

    # Cac thanh phan phai duoc expose thanh cot rieng de cong co the xet.
    assert "title_score" in sql and "skill_score" in sql, (
        "scored CTE khong expose title_score/skill_score -> cong khong chay duoc"
    )


# ─── Trong so moi: title 45, skill 25, city 20, salary 10 ────────────


@pytest.mark.asyncio
async def test_trong_so_moi_tong_100():
    """Doi trong so la thay doi hanh vi, khong phai cosmetic.

    title 40->45, city 25->20, salary 20->10, skill 15->25. Vi gia tri di vao
    bind param (khong nam trong chuoi SQL), kiem tren params.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(
        _user(
            experience_level="fresher",
            desired_titles=["Python"],
            skills=["python"],
            preferred_cities=["Hồ Chí Minh"],
            desired_salary_min=5_000_000,
        )
    )

    params = captured["params"][-1]

    # Gia tri co the la list (titles/skills/cities) — bo di, chi kiem so.
    scalars = [v for v in params.values() if isinstance(v, (int, float))]
    assert 45 in scalars, f"thieu title=45: {scalars}"
    assert 25 in scalars, f"thieu skill=25: {scalars}"
    assert 20 in scalars, f"thieu city=20: {scalars}"
    assert 10 in scalars, f"thieu salary=10: {scalars}"
    assert not (40 in scalars or 15 in scalars), f"van con trong so cu: {scalars}"


# ─── Fallback skill word-boundary (thay `%ai%`) ──────────────────────


@pytest.mark.asyncio
async def test_fallback_skill_word_boundary():
    """Skill 'ai' khong duoc match 'KHAI'/'Sustainability' nua.

    `%ai%` cu match substring: NHAN VIEN TRIEN KHAI THIET KE (KHAI chua 'ai'),
    SustAInability. Phai ra regex `(^|[^[:alnum:]_])ai([^[:alnum:]_]|$)` qua
    `~*` (case-insensitive), khong con ILIKE `%...%`.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(
        _user(experience_level="experienced", skills=["ai"])
    )

    sql = captured["sqls"][-1]
    params = captured["params"][-1]

    assert "title ~*" in sql, f"fallback khong dung regexp_match ~*:\n{sql}"
    assert "%ai%" not in sql, "van dung ILIKE substring cho skill"
    pattern_values = " ".join(str(v) for v in params.values())
    assert "(^|[^[:alnum:]_])ai([^[:alnum:]_]|$)" in pattern_values, (
        f"pattern word-boundary khong dung: {pattern_values}"
    )


@pytest.mark.asyncio
async def test_fallback_escape_ky_tu_dac_biet():
    """Ky tu regex cua skill phai duoc escape (node.js, c++, vertex ai).

    `\y` khong dung duoc: `+`/`.` khong phai word char nen \\yc\\+\\+\\y khong
    match 'Senior C++ Developer'. Phai dung `[^[:alnum:]_]` lam bien va escape
    metachar bang Python (PG16 khong co regexp_escape).
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(
        _user(experience_level="experienced", skills=["c++", "node.js", "vertex ai"])
    )

    params = captured["params"][-1]
    pattern_values = " ".join(str(v) for v in params.values())
    assert "c\\+\\+" in pattern_values, f"'c++' chua duoc escape: {pattern_values}"
    assert "node\\.js" in pattern_values, f"'node.js' chua duoc escape: {pattern_values}"
    assert "vertex\\ ai" in pattern_values or "vertex ai" in pattern_values, (
        f"skill nhieu tu khong giu nguyen: {pattern_values}"
    )
    # Khong duoc co dau `\y` — da duoc loai trong luc kiem chung tren PG16.
    assert "\\y" not in pattern_values, "van dung \\y (fail voi c++)"


# ─── Job co du lieu skill: giu ty le, khong dung fallback ────────────


@pytest.mark.asyncio
async def test_job_co_skill_data_van_dung_ty_le():
    """Job co `skill_ratio` (co crawl skill) van cham theo ty le x25.

    Fallback chi danh cho job KHONG co du lieu skill (`skill_ratio IS NULL`).
    Job da co du lieu van dung `ratio * 25`, khong bi xao tron boi title.
    """
    captured: dict = {}
    matcher = JobMatcher(_fake_db(captured))

    await matcher.find_jobs(
        _user(experience_level="experienced", skills=["python"])
    )

    sql = captured["sqls"][-1]
    assert "skill_ratio" in sql, "mat nhieu skill_ratio"
    assert "IS NULL" in sql, "khong con phan biet 'khong khop' vs 'khong co du lieu'"
