from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import Overview

router = APIRouter(prefix="/api", tags=["overview"])


@router.get("/overview", response_model=Overview)
async def get_overview(db: AsyncSession = Depends(get_db)) -> Overview:
    result = await db.execute(
        text("""
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
        """)
    )
    row = result.mappings().first()
    return Overview(**row)
