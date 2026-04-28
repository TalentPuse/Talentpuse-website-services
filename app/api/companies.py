from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import CompanyRow

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/top", response_model=list[CompanyRow])
async def top_companies(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[CompanyRow]:
    result = await db.execute(
        text("""
            select
                company_name,
                n_jobs::int,
                primary_city,
                round(avg_views::numeric, 0)::float as avg_views,
                round((avg_salary_vnd / 1000000.0)::numeric, 1)::float as avg_salary_million
            from dbt_dev_gold.mart_company_hiring
            order by n_jobs desc, avg_views desc nulls last
            limit :limit
        """),
        {"limit": limit},
    )
    return [CompanyRow(**r) for r in result.mappings().all()]
