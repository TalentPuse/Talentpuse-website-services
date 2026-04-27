"""GET /api/skills/top + /api/skills/highest-paying."""
from fastapi import APIRouter, Query

from app.db import get_conn
from app.models import HighestPayingSkillRow, SkillRow

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/top", response_model=list[SkillRow])
async def top_skills(limit: int = Query(15, ge=1, le=50)) -> list[SkillRow]:
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            select skill, n_jobs::int, pct_of_jobs::float
            from dbt_dev_gold.mart_skill_demand
            order by n_jobs desc
            limit $1
            """,
            limit,
        )
        return [SkillRow(**dict(r)) for r in rows]


@router.get("/highest-paying", response_model=list[HighestPayingSkillRow])
async def highest_paying_skills(
    limit: int = Query(10, ge=1, le=50),
) -> list[HighestPayingSkillRow]:
    async with get_conn() as conn:
        rows = await conn.fetch(
            """
            select
                skill,
                n_jobs::int,
                round((avg_salary_vnd / 1000000.0)::numeric, 1)::float as avg_salary_million
            from dbt_dev_gold.mart_skill_demand
            where avg_salary_vnd is not null
            order by avg_salary_vnd desc
            limit $1
            """,
            limit,
        )
        return [HighestPayingSkillRow(**dict(r)) for r in rows]
