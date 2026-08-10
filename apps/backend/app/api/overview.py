from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import DashboardRow, Overview

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/overview", response_model=Overview)
async def get_overview(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> Overview:
    where = "is_active"
    params: dict = {}
    if category:
        where += " and job_category = :category"
        params["category"] = category

    result = await db.execute(
        text(f"""
            select
                count(*)::int as total_jobs,
                -- coalesce(..., 0) BAT BUOC: khi bo loc khong khop job nao thi
                -- nullif(count(*), 0) tra NULL, phep chia ra NULL, va schema
                -- Overview.pct_with_salary khai bao `float` KHONG Optional nen
                -- Pydantic nem ValidationError -> HTTP 500. Endpoint nay CONG KHAI
                -- (khong can token) nen bat ky ai cung trigger duoc 500 chi bang
                -- mot gia tri `category` khong ton tai. 0 job thi 0% co luong la
                -- dung ve nghia, va khop cach /api/skills/top, /api/salary/by-level,
                -- /api/companies/top da xu ly (tra du lieu rong, khong loi).
                coalesce(round(
                    (100.0 * count(*) filter (where salary_vnd_monthly_avg is not null)
                    / nullif(count(*), 0))::numeric,
                    1
                )::float, 0) as pct_with_salary,
                round(
                    (percentile_cont(0.5) within group (order by salary_vnd_monthly_avg)
                        filter (where salary_vnd_monthly_avg is not null
                                  and salary_vnd_monthly_avg <= 200000000)
                    / 1000000.0)::numeric,
                    1
                )::float as avg_salary_million
            from dbt_dev_gold.fct_jobs_daily
            where {where}
        """),
        params,
    )
    row = result.mappings().first()
    return Overview(**row)


@router.get("/dashboard/categories", response_model=list[str])
async def get_categories(db: AsyncSession = Depends(get_db)) -> list[str]:
    result = await db.execute(text("""
        select distinct job_category
        from dbt_dev_gold.fct_jobs_daily
        where is_active and job_category is not null
        order by job_category
    """))
    return [row["job_category"] for row in result.mappings().all()]


@router.get("/dashboard/cities", response_model=list[DashboardRow])
async def dashboard_cities(
    limit: int = Query(15, ge=1, le=50),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[DashboardRow]:
    cat_cond = "and job_category = :category" if category else ""
    params: dict = {"limit": limit}
    if category:
        params["category"] = category

    # Chi bind :category (khong bao gom :limit) — asyncpg tu choi parameter
    # khong dung den trong SQL.
    total_result = await db.execute(
        text(f"""
            select count(*)::int from dbt_dev_gold.fct_jobs_daily
            where is_active {cat_cond}
        """),
        {"category": category} if category else {},
    )
    total = total_result.scalar() or 1

    result = await db.execute(
        text(f"""
            select
                city_canonical as name,
                count(distinct (source, source_job_id))::int as n_jobs,
                round((100.0 * count(distinct (source, source_job_id))
                       / nullif(:total, 0))::numeric, 1)::float as pct_of_jobs
            from dbt_dev_gold.fct_jobs_daily
            where is_active
                and city_canonical is not null
                {cat_cond}
            group by city_canonical
            order by n_jobs desc
            limit :limit
        """),
        {**params, "total": total},
    )
    return [DashboardRow(**r) for r in result.mappings().all()]


@router.get("/dashboard/levels", response_model=list[DashboardRow])
async def dashboard_levels(
    limit: int = Query(15, ge=1, le=50),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[DashboardRow]:
    cat_cond = "and job_category = :category" if category else ""
    params: dict = {"limit": limit}
    if category:
        params["category"] = category

    # Chi bind :category (khong bao gom :limit) — asyncpg tu choi parameter
    # khong dung den trong SQL.
    total_result = await db.execute(
        text(f"""
            select count(*)::int from dbt_dev_gold.fct_jobs_daily
            where is_active {cat_cond}
        """),
        {"category": category} if category else {},
    )
    total = total_result.scalar() or 1

    result = await db.execute(
        text(f"""
            select
                coalesce(nullif(job_level, ''), 'Không xác định') as name,
                count(distinct (source, source_job_id))::int as n_jobs,
                round((100.0 * count(distinct (source, source_job_id))
                       / nullif(:total, 0))::numeric, 1)::float as pct_of_jobs
            from dbt_dev_gold.fct_jobs_daily
            where is_active
                and job_level is not null
                {cat_cond}
            group by job_level
            order by n_jobs desc
            limit :limit
        """),
        {**params, "total": total},
    )
    return [DashboardRow(**r) for r in result.mappings().all()]
