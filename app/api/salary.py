from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import SalaryByLevelRow

router = APIRouter(prefix="/api/salary", tags=["salary"])


@router.get("/by-level", response_model=list[SalaryByLevelRow])
async def salary_by_level(
    db: AsyncSession = Depends(get_db),
) -> list[SalaryByLevelRow]:
    result = await db.execute(
        text("""
            select
                job_level || ' - ' || city_canonical as level_city,
                job_level,
                city_canonical,
                round((percentile_cont(0.25) within group (order by p50_vnd) / 1000000.0)::numeric, 1)::float as p25_million,
                round((percentile_cont(0.50) within group (order by p50_vnd) / 1000000.0)::numeric, 1)::float as p50_million,
                round((percentile_cont(0.75) within group (order by p50_vnd) / 1000000.0)::numeric, 1)::float as p75_million,
                sum(n_visible_jobs)::int as n_visible_jobs
            from dbt_dev_gold.mart_salary_by_level
            where city_canonical in ('HCMC', 'Hanoi', 'Da Nang')
            group by job_level, city_canonical
            order by 5 desc
        """)
    )
    return [SalaryByLevelRow(**r) for r in result.mappings().all()]
