from io import BytesIO
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core import config
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
    missing_pct = round(missing * 100 / max(total, 1), 1)

    max_posted_at = None
    max_extracted_at = None
    gap_days = None
    try:
        # Try fct_jobs_daily first, fallback to silver_job_detail
        try:
            max_posted_at = (await db.execute(text("SELECT max(posted_at) FROM dbt_dev_gold.fct_jobs_daily WHERE is_active"))).scalar()
        except Exception:
            max_posted_at = None
        if max_posted_at is None:
            try:
                max_posted_at = (await db.execute(text("SELECT max(snapshot_date) FROM dbt_dev_gold.fct_jobs_daily WHERE is_active"))).scalar()
            except Exception:
                pass
        if max_posted_at is None:
            try:
                max_posted_at = (await db.execute(text("SELECT max(posted_at) FROM dbt_dev_silver.silver_job_detail"))).scalar()
            except Exception:
                pass
    except Exception:
        max_posted_at = None
    try:
        max_extracted_at = (await db.execute(text("SELECT max(extracted_at) FROM app.jd_insight"))).scalar()
    except Exception:
        max_extracted_at = None

    # compute gap_days
    try:
        if max_posted_at is not None and max_extracted_at is not None:
            def _to_date(v):
                if isinstance(v, datetime):
                    return v.date()
                if isinstance(v, date):
                    return v
                try:
                    return datetime.fromisoformat(str(v)).date()
                except Exception:
                    return None
            d1 = _to_date(max_posted_at)
            d2 = _to_date(max_extracted_at)
            if d1 is not None and d2 is not None:
                gap_days = (d1 - d2).days
                if gap_days < 0:
                    gap_days = 0
    except Exception:
        gap_days = None

    # llm probes via httpx with _auth_headers logic from jd_extract.py:32
    llm = {"jd": "unknown", "openai": "unknown"}
    try:
        from app.services.jd_extract import _auth_headers

        async def _probe(base_url: str, api_key: str) -> str:
            try:
                headers = _auth_headers(api_key, base_url)
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.post(
                        f"{base_url.rstrip('/')}/chat/completions",
                        json={"model": "test", "messages": [{"role": "user", "content": "hi"}]},
                        headers=headers,
                    )
                    if resp.status_code == 200:
                        return "ok"
                    return f"error:{resp.status_code}"
            except Exception as e:
                return f"fail:{type(e).__name__}"

        try:
            jd_key = getattr(config, "JD_LLM_API_KEY", "")
            jd_base = getattr(config, "JD_LLM_BASE_URL", "https://opencode.ai/zen/v1")
            llm["jd"] = await _probe(jd_base, jd_key)
        except Exception:
            llm["jd"] = "unknown"
        try:
            oai_key = getattr(config, "OPENAI_API_KEY", "")
            oai_base = getattr(config, "OPENAI_BASE_URL", "https://api.openai.com/v1")
            llm["openai"] = await _probe(oai_base, oai_key)
        except Exception:
            llm["openai"] = "unknown"
    except Exception:
        pass

    def _iso(v):
        if v is None:
            return None
        try:
            return v.isoformat() if hasattr(v, "isoformat") else str(v)
        except Exception:
            return str(v)

    return {
        "total_jd": total,
        "extracted": extracted,
        "missing": missing,
        "missing_pct": missing_pct,
        "max_posted_at": _iso(max_posted_at),
        "max_extracted_at": _iso(max_extracted_at),
        "gap_days": gap_days,
        "llm": llm,
    }


@router.get("/skills/top")
async def skills_top(category: str | None = None, city: str | None = None, limit: int = Query(20, ge=1, le=100), user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
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
async def tools_top(category: str | None = None, city: str | None = None, limit: int = Query(20, ge=1, le=100), user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
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
async def languages_top(category: str | None = None, limit: int = Query(20, ge=1, le=100), user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
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
async def benefits_top(category: str | None = None, city: str | None = None, limit: int = Query(20, ge=1, le=100), user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
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


@router.get("/export.xlsx")
async def export_xlsx(
    category: str | None = Query(None),
    city: str | None = Query(None),
    kind: str = Query("skills", pattern="^(skills|tools|languages|benefits|all)$"),
    limit: int = Query(20, ge=1, le=200),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    from openpyxl import Workbook

    wb = Workbook()
    # Determine sheets to create
    if kind == "all":
        kinds = ["skills", "tools", "languages", "benefits", "experience"]
    else:
        kinds = [kind]

    first = True
    for k in kinds:
        if first:
            ws = wb.active
            ws.title = k
            first = False
        else:
            ws = wb.create_sheet(title=k)

        if k == "skills":
            ws.append(["skill", "n_jobs"])
            data = await skills_top(category, city, limit, user, db)
            for row in data:
                ws.append([row.get("skill"), row.get("n_jobs")])
        elif k == "tools":
            ws.append(["tool", "n_jobs"])
            data = await tools_top(category, city, limit, user, db)
            for row in data:
                ws.append([row.get("tool"), row.get("n_jobs")])
        elif k == "languages":
            ws.append(["lang", "level", "n_jobs"])
            data = await languages_top(category, limit, user, db)
            for row in data:
                ws.append([row.get("lang"), row.get("level"), row.get("n_jobs")])
        elif k == "benefits":
            ws.append(["benefit", "n_jobs"])
            data = await benefits_top(category, city, limit, user, db)
            for row in data:
                ws.append([row.get("benefit"), row.get("n_jobs")])
        elif k == "experience":
            ws.append(["bucket", "n_jobs"])
            data = await experience_dist(category, user, db)
            for row in data:
                ws.append([row.get("bucket"), row.get("n_jobs")])
        else:
            ws.append(["name", "n_jobs"])
            data = await skills_top(category, city, limit, user, db)
            for row in data:
                ws.append([row.get("skill") or row.get("tool") or row.get("lang"), row.get("n_jobs")])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f'TalentPulse_Pro_{category or "All"}.xlsx'
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/report")
async def report(category: str | None = Query(None), user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    skills = await skills_top(category, None, 10, user, db)
    tools = await tools_top(category, None, 10, user, db)
    languages = await languages_top(category, 10, user, db)
    benefits = await benefits_top(category, None, 10, user, db)
    # Use _filter_sql correctly for experience (via helper) or raw if needed
    extra, params = _filter_sql(category)
    # also fetch experience via helper for consistency
    experience = await experience_dist(category, user, db)

    # missing stats for data_note
    total = (await db.execute(text("SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"))).scalar() or 0
    extracted = (await db.execute(text("SELECT count(*) FROM app.jd_insight"))).scalar() or 0
    missing = max(total - extracted, 0)
    missing_pct = round(missing * 100 / max(total, 1), 1)

    # optional gap_days context
    gap_days = None
    try:
        max_posted_at = (await db.execute(text("SELECT max(posted_at) FROM dbt_dev_gold.fct_jobs_daily WHERE is_active"))).scalar()
        if max_posted_at is None:
            max_posted_at = (await db.execute(text("SELECT max(posted_at) FROM dbt_dev_silver.silver_job_detail"))).scalar()
        max_extracted_at = (await db.execute(text("SELECT max(extracted_at) FROM app.jd_insight"))).scalar()
        if max_posted_at is not None and max_extracted_at is not None:
            def _to_date(v):
                if isinstance(v, datetime):
                    return v.date()
                if isinstance(v, date):
                    return v
                try:
                    return datetime.fromisoformat(str(v)).date()
                except Exception:
                    return None
            d1 = _to_date(max_posted_at)
            d2 = _to_date(max_extracted_at)
            if d1 and d2:
                gap_days = (d1 - d2).days
                if gap_days < 0:
                    gap_days = 0
    except Exception:
        gap_days = None

    top_skills_str = ", ".join([s["skill"] for s in skills[:3]]) or "no data"
    top_tools_str = ", ".join([t["tool"] for t in tools[:3]]) or "no data"
    narrative = f"Top 3 skills for {category or 'All'}: {top_skills_str}. Top tools: {top_tools_str}."
    if gap_days is not None:
        narrative += f" Gap days: {gap_days}."

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "category": category,
        "narrative": narrative,
        "tables": {"skills": skills, "tools": tools, "languages": languages, "benefits": benefits, "experience": experience},
        "data_note": f"Based on {extracted} extracted jobs, missing {missing} ({missing_pct}%)",
        "missing": missing,
        "missing_pct": missing_pct,
        "gap_days": gap_days,
    }


@router.get("/jobs/{source}/{source_job_id}/insight")
async def job_insight(source: str, source_job_id: str, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    data = await get_insight(db, source, source_job_id)
    if data is None:
        raise HTTPException(404, "Chua co insight cho job nay")
    return data
