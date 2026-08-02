"""Fixture chung cho test job_fit.

Cac test trong goi nay chia lam hai loai:

  - Test thuan logic (test_criteria / test_profile / test_scoring /
    test_facts_sql): khong cham DB, chay o dau cung duoc.
  - Test tich hop (test_rerank / test_detail_endpoint / test_no_source_bias):
    doc THAT tu bang kho `dbt_dev_gold.fct_jobs_daily` va
    `dbt_dev_silver.silver_job_detail`.

Loai thu hai khong the chay tren CI: service Postgres cua GitHub Actions la
mot container rong, khong co schema `dbt_dev_*` (chung do dbt sinh ra o box
warehouse, khong nam trong migration cua app). Truoc khi co file nay, chung
no thang CI voi `UndefinedTableError` va lam ca job test do — keo theo buoc
deploy khong chay, tuc la mot bai test khong chay duoc o CI da chan luon
duong sua loi len production.

Fixture `warehouse` duoi day bo qua chung mot cach CO CHU DICH, kem ly do
doc duoc trong output pytest. CO Y khong dat autouse: neu autouse thi bon
test logic thuan cung bi bo qua khi vang kho, va ta mat do bao phu ma khong
ai nhan ra.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.core import database as db_module

BANG_KHO = ("dbt_dev_gold.fct_jobs_daily", "dbt_dev_silver.silver_job_detail")


@pytest_asyncio.fixture
async def warehouse():
    """Bo qua bai test neu bang kho chua ton tai o DB dang tro toi.

    Dung `to_regclass` chu khong phai `SELECT ... LIMIT 1`: no tra NULL khi
    bang vang mat thay vi nem loi, nen phan biet duoc "khong co bang" voi
    "co bang nhung rong" — hai truong hop can xu ly khac nhau.
    """
    if db_module.async_session_factory is None:
        pytest.fail("DB chua duoc khoi tao")

    async with db_module.async_session_factory() as s:
        for bang in BANG_KHO:
            ton_tai = (await s.execute(text("SELECT to_regclass(:t)"), {"t": bang})).scalar()
            if ton_tai is None:
                pytest.skip(
                    f"Bo qua: bang kho `{bang}` khong ton tai. "
                    "Cac test nay can du lieu dbt that (box warehouse); "
                    "Postgres rong cua CI khong co."
                )
    yield
