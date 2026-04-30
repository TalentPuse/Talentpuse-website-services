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
                round((p25_vnd / 1000000.0)::numeric, 1)::float as p25_million,
                round((p50_vnd / 1000000.0)::numeric, 1)::float as p50_million,
                round((p75_vnd / 1000000.0)::numeric, 1)::float as p75_million,
                n_visible_jobs::int
            from dbt_dev_gold.mart_salary_by_level
            where city_canonical in ('HCMC', 'Hanoi', 'Da Nang')
            order by p50_vnd desc
        """)
    )
    return [SalaryByLevelRow(**r) for r in result.mappings().all()]
