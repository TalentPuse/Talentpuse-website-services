"""GET /api/salary/by-level — salary percentiles grouped by level x city."""
from fastapi import APIRouter

from app.db import get_conn
from app.models import SalaryByLevelRow

router = APIRouter(prefix="/api/salary", tags=["salary"])


@router.get("/by-level", response_model=list[SalaryByLevelRow])
async def salary_by_level() -> list[SalaryByLevelRow]:
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            select
                job_level || ' - ' || city_canonical as level_city,
                job_level,
                city_canonical,
                round((p25_vnd / 1000000.0)::numeric, 1)::float as p25_million,
                round((p50_vnd / 1000000.0)::numeric, 1)::float as p50_million,
                round((p75_vnd / 1000000.0)::numeric, 1)::float as p75_million,
                n_visible_jobs::int
            from dbt_dev_gold.mart_salary_by_level
            order by p50_vnd desc
            """
        )
        return [SalaryByLevelRow(**dict(r)) for r in rows]
