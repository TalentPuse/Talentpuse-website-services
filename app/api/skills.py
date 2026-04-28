from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import HighestPayingSkillRow, SkillRow

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/top", response_model=list[SkillRow])
async def top_skills(
    limit: int = Query(15, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[SkillRow]:
    result = await db.execute(
        text("""
            select skill, n_jobs::int, pct_of_jobs::float
            from dbt_dev_gold.mart_skill_demand
            order by n_jobs desc
            limit :limit
        """),
        {"limit": limit},
    )
    return [SkillRow(**r) for r in result.mappings().all()]


@router.get("/highest-paying", response_model=list[HighestPayingSkillRow])
async def highest_paying_skills(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[HighestPayingSkillRow]:
    result = await db.execute(
        text("""
            select
                skill,
                n_jobs::int,
                round((avg_salary_vnd / 1000000.0)::numeric, 1)::float as avg_salary_million
            from dbt_dev_gold.mart_skill_demand
            where avg_salary_vnd is not null
            order by avg_salary_vnd desc
            limit :limit
        """),
        {"limit": limit},
    )
    return [HighestPayingSkillRow(**r) for r in result.mappings().all()]
