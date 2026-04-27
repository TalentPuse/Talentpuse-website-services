"""GET /api/companies/top — top hiring companies."""
from fastapi import APIRouter, Query

from app.db import get_conn
from app.models import CompanyRow

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/top", response_model=list[CompanyRow])
async def top_companies(limit: int = Query(20, ge=1, le=100)) -> list[CompanyRow]:
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            select
                company_name,
                n_jobs::int,
                primary_city,
                round(avg_views::numeric, 0)::float as avg_views,
                round((avg_salary_vnd / 1000000.0)::numeric, 1)::float as avg_salary_million
            from dbt_dev_gold.mart_company_hiring
            order by n_jobs desc, avg_views desc nulls last
            limit $1
            """,
            limit,
        )
        return [CompanyRow(**dict(r)) for r in rows]
