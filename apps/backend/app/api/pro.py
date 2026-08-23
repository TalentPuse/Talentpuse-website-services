from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.jd_insight_repo import get_insight

router = APIRouter(prefix="/api/pro", tags=["pro"])

SYNONYM_MAP = {"artificial intelligence": "ai", "machine learning": "ml", "nodejs": "node.js", "reactjs": "react"}


def _norm_skill(raw: str) -> str:
    return SYNONYM_MAP.get((raw or "").strip().lower(), (raw or "").strip().lower())


def _filter_sql(category: str | None, city: str | None = None, alias: str = "i") -> tuple[str, dict]:
    conds, params = [], {}
    if category:
        conds.append(f"{alias}.data->'job'->>'job_category' = :category")
        params["category"] = category
    if city:
        conds.append(f"{alias}.data->'job'->>'city_canonical' = :city")
        params["city"] = city
    return (" AND " + " AND ".join(conds)) if conds else "", params


async def require_pro(user: User = Depends(get_current_user)):
    if user.subscription_tier != "pro" and not user.is_admin:
        raise HTTPException(403, "Pro subscription required")
    return user


@router.get("/health")
async def health(user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    total = (await db.execute(text("SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"))).scalar() or 0
    extracted = (await db.execute(text("SELECT count(*) FROM app.jd_insight"))).scalar() or 0
    missing = max(total - extracted, 0)
    return {"total_jd": total, "extracted": extracted, "missing": missing, "missing_pct": round(missing*100/max(total,1),1), "llm": {"jd": "unknown", "openai": "unknown"}}


@router.get("/skills/top")
async def skills_top(category: str | None = None, city: str | None = None, limit: int = 20, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    extra, params = _filter_sql(category, city)
    rows = await db.execute(text(f"""
        SELECT lower(btrim(s.skill)) AS skill, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'hard') AS s(skill)
        WHERE 1=1 {extra}
        GROUP BY 1
        ORDER BY n_jobs DESC
    """), params)
    merged: dict[str, int] = {}
    for r in rows.mappings():
        norm = _norm_skill(r["skill"])
        merged[norm] = merged.get(norm, 0) + r["n_jobs"]
    top = sorted(merged.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    return [{"skill": skill, "n_jobs": n} for skill, n in top]


@router.get("/tools/top")
async def tools_top(category: str | None = None, city: str | None = None, limit: int = 20, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    extra, params = _filter_sql(category, city)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT s.tool, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'tools') AS s(tool)
        WHERE 1=1 {extra}
        GROUP BY s.tool
        ORDER BY n_jobs DESC
        LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/languages/top")
async def languages_top(category: str | None = None, limit: int = 20, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    extra, params = _filter_sql(category)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT l->>'lang' AS lang, l->>'level' AS level, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements(i.data->'skills'->'languages') AS l
        WHERE 1=1 {extra}
        GROUP BY 1, 2
        ORDER BY n_jobs DESC, level NULLS LAST
        LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/benefits/top")
async def benefits_top(category: str | None = None, city: str | None = None, limit: int = 20, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    extra, params = _filter_sql(category, city)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT b.benefit, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'benefits') AS b(benefit)
        WHERE 1=1 {extra}
        GROUP BY b.benefit ORDER BY n_jobs DESC LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/requirements/experience")
async def experience_dist(category: str | None = None, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    extra, params = _filter_sql(category)
    rows = await db.execute(text(f"""
        SELECT
            CASE
                WHEN (i.data->'requirements'->'years_experience'->>'min')::int IS NULL THEN 'khong_de_cap'
                WHEN (i.data->'requirements'->'years_experience'->>'min')::int <= 1 THEN '0-1 nam'
                WHEN (i.data->'requirements'->'years_experience'->>'min')::int <= 3 THEN '2-3 nam'
                ELSE '4+ nam'
            END AS bucket,
            count(*)::int AS n_jobs
        FROM app.jd_insight i
        WHERE 1=1 {extra}
        GROUP BY 1 ORDER BY n_jobs DESC
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/jobs/{source}/{source_job_id}/insight")
async def job_insight(source: str, source_job_id: str, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    data = await get_insight(db, source, source_job_id)
    if data is None:
        raise HTTPException(404, "Chua co insight cho job nay")
    return data
