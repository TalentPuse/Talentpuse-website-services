from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import SkillRow

router = APIRouter(prefix="/api/skills", tags=["skills"])


@router.get("/top", response_model=list[SkillRow])
async def top_skills(
    limit: int = Query(15, ge=1, le=50),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
) -> list[SkillRow]:
    if not category:
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

    total_result = await db.execute(
        text("""
            select count(*)::int from dbt_dev_gold.fct_jobs_daily
            where is_active and job_category = :category
        """),
        {"category": category},
    )
    total = total_result.scalar() or 1

    result = await db.execute(
        text("""
            select
                sk.skill_name_norm as skill,
                count(distinct (f.source, f.source_job_id))::int as n_jobs,
                round((100.0 * count(distinct (f.source, f.source_job_id)) / :total)::numeric, 1)::float as pct_of_jobs
            from dbt_dev_gold.fct_jobs_daily f
            join dbt_dev_silver.silver_skill_long sk
                on sk.source = f.source and sk.source_job_id = f.source_job_id
            where f.is_active and f.job_category = :category
            group by sk.skill_name_norm
            order by n_jobs desc
            limit :limit
        """),
        {"category": category, "limit": limit, "total": total},
    )
    return [SkillRow(**r) for r in result.mappings().all()]
