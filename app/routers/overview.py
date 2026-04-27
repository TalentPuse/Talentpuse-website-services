"""GET /api/overview — 3 KPIs for top of dashboard."""
from fastapi import APIRouter

from app.db import get_conn
from app.models import Overview

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/overview", response_model=Overview)
async def get_overview() -> Overview:
    async with get_conn() as conn:
        row = await conn.fetchrow(
            """
            select
                count(*)::int as total_jobs,
                round(
                    (100.0 * count(*) filter (where salary_vnd_monthly_avg is not null)
                    / nullif(count(*), 0))::numeric,
                    1
                )::float as pct_with_salary,
                round(
                    (avg(salary_vnd_monthly_avg) filter (where salary_vnd_monthly_avg is not null)
                    / 1000000.0)::numeric,
                    1
                )::float as avg_salary_million
            from dbt_dev_gold.fct_jobs_daily
            where is_active
            """
        )
        return Overview(**dict(row))
