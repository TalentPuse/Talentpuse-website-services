"""Kiem chung bieu thuc regex khop ky nang CHAY THAT tren Postgres.

Day la test tich hop co chu dich: cai de sai o day khong phai logic Python ma la
hanh vi regex cua Postgres, va no chi lo ra khi chay that.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core import database as db_module
from app.services.job_fit.facts import SKILL_REGEX_SQL

# (ky nang, doan van, co phai khop khong)
CASES = [
    # Bien tu chan khop chuoi con — day la ly do khong dung ILIKE '%x%'
    ("ai", "Please send your email to us", False),
    ("ai", "Applied AI research team", True),
    ("sql", "Deep MySQL and PostgreSQL knowledge", False),
    ("sql", "Strong SQL skills", True),
    ("go", "Golang microservices, Google Cloud", False),
    ("go", "We write Go and Rust", True),
    # Ky nang co metachar regex — phai escape, khong duoc no loi
    ("ci/cd", "Build CI/CD pipelines with Jenkins", True),
    ("node.js", "Backend in Node.js and Express", True),
    ("node.js", "We use NodeXjs internally", False),   # '.' phai la literal
    ("vega-lite", "Charts with Vega-Lite and D3", True),
    # Ky nang co bien KHONG phai chu tu — gan bien tu vo dieu kien se KHONG BAO
    # GIO khop, va no im lang chu khong bao loi. Bon ca nay la ly do ton tai cua
    # phan CASE WHEN trong SKILL_REGEX_SQL.
    ("c++", "Strong C++ and Rust experience required", True),
    ("c++", "Experience with C and Java", False),
    ("c#", "Backend in C# and .NET", True),
    ("c#", "We use C and Go", False),
    ("f#", "We write F# on the backend", True),
    (".net", "ASP.NET Core microservices", True),
    (".net", "Building a social network platform", False),
]


@pytest.mark.asyncio
@pytest.mark.parametrize("skill,haystack,expected", CASES)
async def test_khop_ky_nang_theo_bien_tu(skill: str, haystack: str, expected: bool):
    await db_module.init_db()
    async with db_module.async_session_factory() as db:
        got = (await db.execute(
            text(f"SELECT :hay ~* ({SKILL_REGEX_SQL.format(skill=':sk')})"),
            {"hay": haystack, "sk": skill},
        )).scalar()
    assert got is expected, f"{skill!r} vs {haystack!r}"
