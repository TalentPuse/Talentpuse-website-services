"""API paid /api/v1 — ban insight tu JD. Auth: X-API-Key + quota."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.api_key import ApiKey
from app.services.jd_insight_repo import get_insight
from app.services.paid_quota import hash_key, rate_limit_ok, verify_key

router = APIRouter(prefix="/api/v1", tags=["paid"])


async def require_api_key(
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> None:
    if not x_api_key:
        raise HTTPException(401, "Thieu X-API-Key")
    if not rate_limit_ok("x"):  # fail-open, placeholder hash
        raise HTTPException(429, "Qua nhieu request trong 1 phut")
    if not await verify_key(db, x_api_key):
        # verify_key chi tra False: key sai/revoked HOAC het quota — phan biet
        # de tra 429 (het quota) thay vi 401, theo interface cua brief.
        row = (await db.execute(
            select(ApiKey).where(ApiKey.key_hash == hash_key(x_api_key))
        )).scalar_one_or_none()
        if row is not None and row.is_active and row.used_count >= row.quota_month:
            raise HTTPException(429, "Het quota trong thang")
        raise HTTPException(401, "API key khong hop le hoac da het quota")
    return None


def _filter_sql(category: str | None, city: str | None, alias: str = "i") -> tuple[str, dict]:
    conds, params = [], {}
    if category:
        conds.append(f"{alias}.data->'job'->>'job_category' = :category")
        params["category"] = category
    if city:
        conds.append(f"{alias}.data->'job'->>'city_canonical' = :city")
        params["city"] = city
    return (" AND " + " AND ".join(conds)) if conds else "", params


@router.get("/skills/top")
async def skills_top(
    category: str | None = Query(None),
    city: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category, city)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT s.skill, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'hard') AS s(skill)
        WHERE 1=1 {extra}
        GROUP BY s.skill
        ORDER BY n_jobs DESC
        LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/tools/top")
async def tools_top(
    category: str | None = Query(None),
    city: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
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
async def languages_top(
    category: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    extra, params = _filter_sql(category)
    params["limit"] = limit
    rows = await db.execute(text(f"""
        SELECT l->>'lang' AS lang, count(*)::int AS n_jobs
        FROM app.jd_insight i
        CROSS JOIN LATERAL jsonb_array_elements(i.data->'skills'->'languages') AS l
        WHERE 1=1 {extra}
        GROUP BY 1 ORDER BY n_jobs DESC LIMIT :limit
    """), params)
    return [dict(r) for r in rows.mappings()]


@router.get("/benefits/top")
async def benefits_top(
    category: str | None = Query(None),
    city: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
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
async def experience_dist(
    category: str | None = Query(None),
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
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
async def job_insight(
    source: str,
    source_job_id: str,
    _: None = Depends(require_api_key),
    db: AsyncSession = Depends(get_db),
) -> dict:
    data = await get_insight(db, source, source_job_id)
    if data is None:
        raise HTTPException(404, "Chua co insight cho job nay")
    return data
