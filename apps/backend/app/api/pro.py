import asyncio
import re
from io import BytesIO
from datetime import datetime, timezone, date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.core import config
from app.core.config import VN_TZ
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.jd_insight_repo import get_insight

router = APIRouter(prefix="/api/pro", tags=["pro"])

SYNONYM_MAP = {
    "artificial intelligence": "ai",
    "machine learning": "ml",
    "nodejs": "node.js",
    "reactjs": "react",
    "react.js": "react",
    "nextjs": "next.js",
    "next.js": "next.js",
    "vuejs": "vue",
    "vue.js": "vue",
}


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


def _khoang_ngay_pro(date_from: str | None, date_to: str | None) -> tuple[datetime | None, datetime | None]:
    """Parse YYYY-MM-DD date strings to VN_TZ datetimes (THEO NGÀY).

    - date_from -> 00:00:00 VN at start of that day
    - date_to   -> 23:59:59.999999 VN at end of that day (inclusive)
    - raises 422 if format invalid or date_from > date_to
    Similar to admin._khoang_ngay (admin.py:61) but accepts plain date strings
    and uses strict YYYY-MM-DD parsing.
    """
    def _doc(v: str | None, ten: str) -> datetime | None:
        if not v:
            return None
        # allow YYYY-MM-DD only; fromisoformat also handles YYYY-MM-DDTHH:MM etc. but we validate
        try:
            # strict YYYY-MM-DD
            dt = datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            try:
                # fallback: fromisoformat for YYYY-MM-DD with possible time
                dt = datetime.fromisoformat(v)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{ten} khong phai ngay hop le (can YYYY-MM-DD): {v!r}",
                )
        # naive -> VN_TZ, aware -> convert to VN_TZ
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=VN_TZ)
        else:
            dt = dt.astimezone(VN_TZ)
        return dt

    tu = _doc(date_from, "date_from")
    den = _doc(date_to, "date_to")
    # if date_to is date-only (00:00:00), extend to end of day (same as admin._khoang_ngay)
    if den is not None and (den.hour, den.minute, den.second, den.microsecond) == (0, 0, 0, 0):
        den = den.replace(hour=23, minute=59, second=59, microsecond=999999)
    if tu is not None and den is not None and tu > den:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from phai truoc date_to",
        )
    return tu, den


def _date_filter_sql(
    tu: datetime | None, den: datetime | None, alias: str = "i", col: str = "extracted_at"
) -> tuple[str, dict]:
    """Build WHERE fragment for date range on alias.col (timestamptz)."""
    conds: list[str] = []
    params: dict = {}
    if tu is not None:
        conds.append(f"{alias}.{col} >= :date_from")
        params["date_from"] = tu
    if den is not None:
        conds.append(f"{alias}.{col} <= :date_to")
        params["date_to"] = den
    return (" AND " + " AND ".join(conds)) if conds else "", params


_RE_EMAIL = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_RE_PHONE_VN = re.compile(r"(?:\+84|84|0)[\s\-\.]*\d(?:[\s\-\.]*\d){8,9}")
_RE_DIGITS_9_12 = re.compile(r"\b\d{9,12}\b")


def _strip_pii(text_val: str | None) -> str:
    if not text_val:
        return ""
    s = _RE_EMAIL.sub("[redacted]", text_val)
    s = _RE_PHONE_VN.sub("[redacted]", s)
    s = _RE_DIGITS_9_12.sub("[redacted]", s)
    return s


# LIKE wildcards must be escaped — same logic as job_matcher._mau_chua (job_matcher.py:190)
_ILIKE_ESC = str.maketrans({"\\": "\\\\", "%": "\\%", "_": "\\_"})


def _like_pattern(v: str) -> str:
    """User input → ILIKE '%<escaped>%' (PG default escape is backslash)."""
    return f"%{v.translate(_ILIKE_ESC)}%"


async def require_pro(user: User = Depends(get_current_user)):
    if user.subscription_tier != "pro" and not user.is_admin:
        raise HTTPException(403, "Pro subscription required")
    return user


@router.get("/health")
async def health(
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    try:
        if tu is not None or den is not None:
            conds = ["length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"]
            params: dict = {}
            if tu is not None:
                conds.append("posted_at >= :date_from")
                params["date_from"] = tu
            if den is not None:
                conds.append("posted_at <= :date_to")
                params["date_to"] = den
            where_sql = " AND ".join(conds)
            total = (await db.execute(text(f"SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE {where_sql}"), params)).scalar() or 0
        else:
            total = (await db.execute(text("SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"))).scalar() or 0
    except Exception:
        await db.rollback()
        total = 0
    try:
        if tu is not None or den is not None:
            conds2: list[str] = []
            params2: dict = {}
            if tu is not None:
                conds2.append("extracted_at >= :date_from")
                params2["date_from"] = tu
            if den is not None:
                conds2.append("extracted_at <= :date_to")
                params2["date_to"] = den
            where2 = (" WHERE " + " AND ".join(conds2)) if conds2 else ""
            extracted = (await db.execute(text(f"SELECT count(*) FROM app.jd_insight{where2}"), params2)).scalar() or 0
        else:
            extracted = (await db.execute(text("SELECT count(*) FROM app.jd_insight"))).scalar() or 0
    except Exception:
        await db.rollback()
        extracted = 0
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
            await db.rollback()
            max_posted_at = None
        if max_posted_at is None:
            try:
                max_posted_at = (await db.execute(text("SELECT max(snapshot_date) FROM dbt_dev_gold.fct_jobs_daily WHERE is_active"))).scalar()
            except Exception:
                await db.rollback()
                pass
        if max_posted_at is None:
            try:
                max_posted_at = (await db.execute(text("SELECT max(posted_at) FROM dbt_dev_silver.silver_job_detail"))).scalar()
            except Exception:
                await db.rollback()
                pass
    except Exception:
        await db.rollback()
        max_posted_at = None
    try:
        max_extracted_at = (await db.execute(text("SELECT max(extracted_at) FROM app.jd_insight"))).scalar()
    except Exception:
        await db.rollback()
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

        jd_key = getattr(config, "JD_LLM_API_KEY", "")
        jd_base = getattr(config, "JD_LLM_BASE_URL", "https://opencode.ai/zen/v1")
        oai_key = getattr(config, "OPENAI_API_KEY", "")
        oai_base = getattr(config, "OPENAI_BASE_URL", "https://api.openai.com/v1")
        results = await asyncio.gather(
            _probe(jd_base, jd_key), _probe(oai_base, oai_key), return_exceptions=True
        )
        llm["jd"] = results[0] if not isinstance(results[0], Exception) else f"fail:{type(results[0]).__name__}"
        llm["openai"] = results[1] if not isinstance(results[1], Exception) else f"fail:{type(results[1]).__name__}"
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


@router.get("/cities")
async def pro_cities(
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    """Distinct city_canonical values for Pro filter (dynamic, fallback to hardcode).

    Primary source is app.jd_insight (JSONB city_canonical). Falls back to
    dbt gold/silver if jd_insight is empty or query fails, so the dropdown is
    never empty in production. Protected by require_pro like other Pro endpoints.
    """
    try:
        rows = await db.execute(
            text(
                "SELECT DISTINCT btrim(data->'job'->>'city_canonical') AS city "
                "FROM app.jd_insight "
                "WHERE data->'job'->>'city_canonical' IS NOT NULL "
                "AND btrim(data->'job'->>'city_canonical') != '' "
                "ORDER BY city"
            )
        )
        cities = [r[0] for r in rows if r[0]]
        if not cities:
            try:
                rows2 = await db.execute(
                    text(
                        "SELECT DISTINCT btrim(city_canonical) AS city "
                        "FROM dbt_dev_gold.fct_jobs_daily "
                        "WHERE city_canonical IS NOT NULL AND btrim(city_canonical) != '' "
                        "ORDER BY city"
                    )
                )
                cities = [r[0] for r in rows2 if r[0]]
            except Exception:
                await db.rollback()
        if not cities:
            try:
                rows3 = await db.execute(
                    text(
                        "SELECT DISTINCT btrim(city_canonical) AS city "
                        "FROM dbt_dev_silver.silver_job_detail "
                        "WHERE city_canonical IS NOT NULL AND btrim(city_canonical) != '' "
                        "ORDER BY city"
                    )
                )
                cities = [r[0] for r in rows3 if r[0]]
            except Exception:
                await db.rollback()
        return cities
    except Exception:
        await db.rollback()
        return []


@router.get("/skills/top")
async def skills_top(
    category: str | None = None,
    city: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    extra, params = _filter_sql(category, city)
    date_extra, date_params = _date_filter_sql(tu, den, alias="i", col="extracted_at")
    extra += date_extra
    params.update(date_params)
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
async def tools_top(
    category: str | None = None,
    city: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    extra, params = _filter_sql(category, city)
    date_extra, date_params = _date_filter_sql(tu, den, alias="i", col="extracted_at")
    extra += date_extra
    params.update(date_params)
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
    category: str | None = None,
    city: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    extra, params = _filter_sql(category, city)
    date_extra, date_params = _date_filter_sql(tu, den, alias="i", col="extracted_at")
    extra += date_extra
    params.update(date_params)
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
async def benefits_top(
    category: str | None = None,
    city: str | None = None,
    limit: int = Query(10, ge=1, le=100),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    extra, params = _filter_sql(category, city)
    date_extra, date_params = _date_filter_sql(tu, den, alias="i", col="extracted_at")
    extra += date_extra
    params.update(date_params)
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
    category: str | None = None,
    city: str | None = None,
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    extra, params = _filter_sql(category, city)
    date_extra, date_params = _date_filter_sql(tu, den, alias="i", col="extracted_at")
    extra += date_extra
    params.update(date_params)
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
    title: str | None = Query(None, description="Filter raw JD by job title substring (ILIKE)"),
    search: str | None = Query(None, description="Alias for title"),
    kind: str = Query("skills", pattern="^(skills|tools|languages|benefits|experience|raw|all)$"),
    limit: int = Query(10, ge=1, le=200),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    from openpyxl import Workbook

    tu, den = _khoang_ngay_pro(date_from, date_to)

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
            # raw sheet is named raw_jds per spec
            ws.title = "raw_jds" if k == "raw" else k
            first = False
        else:
            ws = wb.create_sheet(title="raw_jds" if k == "raw" else k)

        if k == "skills":
            ws.append(["skill", "n_jobs"])
            data = await skills_top(category, city, limit, date_from, date_to, user, db)
            for row in data:
                ws.append([row.get("skill"), row.get("n_jobs")])
        elif k == "tools":
            ws.append(["tool", "n_jobs"])
            data = await tools_top(category, city, limit, date_from, date_to, user, db)
            for row in data:
                ws.append([row.get("tool"), row.get("n_jobs")])
        elif k == "languages":
            ws.append(["lang", "level", "n_jobs"])
            data = await languages_top(category, city, limit, date_from, date_to, user, db)
            for row in data:
                ws.append([row.get("lang"), row.get("level"), row.get("n_jobs")])
        elif k == "benefits":
            ws.append(["benefit", "n_jobs"])
            data = await benefits_top(category, city, limit, date_from, date_to, user, db)
            for row in data:
                ws.append([row.get("benefit"), row.get("n_jobs")])
        elif k == "experience":
            ws.append(["bucket", "n_jobs"])
            data = await experience_dist(category, city, date_from, date_to, user, db)
            for row in data:
                ws.append([row.get("bucket"), row.get("n_jobs")])
        elif k == "raw":
            ws.append([
                "source", "source_job_id", "title", "company_name", "city_canonical",
                "job_level", "job_category", "posted_at", "source_url",
                "job_description_text", "job_requirement_text", "primary_address", "city_raw_vi",
            ])
            # Query raw JDs: silver_job_detail left join latest gold snapshot
            #  - filter by category (job_category) and city (city_canonical) if provided
            #  - PII stripped for description/requirement via _strip_pii
            #  - order by posted_at DESC / snapshot_date DESC, limit 1..200
            raw_rows = []
            try:
                conds = []
                params: dict = {}
                if category:
                    conds.append("COALESCE(f.job_category, d.job_category) = :category")
                    params["category"] = category
                if city:
                    conds.append("COALESCE(f.city_canonical, d.city_canonical) = :city")
                    params["city"] = city
                _title_raw = (title or search or "").strip() if (title or search) else ""
                if _title_raw:
                    conds.append("COALESCE(f.title, d.title) ILIKE :title")
                    params["title"] = _like_pattern(_title_raw)
                if tu is not None:
                    conds.append("COALESCE(f.posted_at, d.posted_at) >= :date_from")
                    params["date_from"] = tu
                if den is not None:
                    conds.append("COALESCE(f.posted_at, d.posted_at) <= :date_to")
                    params["date_to"] = den
                where_sql = (" WHERE " + " AND ".join(conds)) if conds else ""
                params["limit"] = limit
                rows = await db.execute(text(f"""
                    WITH latest_gold AS (
                        SELECT DISTINCT ON (source, source_job_id)
                            source, source_job_id, title, company_name, city_canonical,
                            job_level, job_category, posted_at, snapshot_date
                        FROM dbt_dev_gold.fct_jobs_daily
                        ORDER BY source, source_job_id, snapshot_date DESC NULLS LAST, posted_at DESC NULLS LAST
                    )
                    SELECT
                        d.source,
                        d.source_job_id,
                        COALESCE(f.title, d.title) AS title,
                        COALESCE(f.company_name, d.company_name) AS company_name,
                        COALESCE(f.city_canonical, d.city_canonical) AS city_canonical,
                        COALESCE(f.job_level, d.job_level) AS job_level,
                        COALESCE(f.job_category, d.job_category) AS job_category,
                        COALESCE(f.posted_at, d.posted_at) AS posted_at,
                        d.source_url,
                        d.job_description_text,
                        d.job_requirement_text,
                        d.primary_address,
                        d.city_raw_vi,
                        COALESCE(f.snapshot_date, d.posted_at) AS snapshot_date
                    FROM dbt_dev_silver.silver_job_detail d
                    LEFT JOIN latest_gold f
                        ON f.source = d.source AND f.source_job_id = d.source_job_id
                    {where_sql}
                    ORDER BY COALESCE(f.posted_at, d.posted_at) DESC NULLS LAST, snapshot_date DESC NULLS LAST, d.source, d.source_job_id
                    LIMIT :limit
                """), params)
                raw_rows = list(rows.mappings())
            except Exception:
                await db.rollback()
                # Fallback: silver only (gold table may be missing in CI / empty DB)
                try:
                    conds2 = []
                    params2: dict = {}
                    if category:
                        conds2.append("d.job_category = :category")
                        params2["category"] = category
                    if city:
                        conds2.append("d.city_canonical = :city")
                        params2["city"] = city
                    _title_raw2 = (title or search or "").strip() if (title or search) else ""
                    if _title_raw2:
                        conds2.append("d.title ILIKE :title")
                        params2["title"] = _like_pattern(_title_raw2)
                    if tu is not None:
                        conds2.append("d.posted_at >= :date_from")
                        params2["date_from"] = tu
                    if den is not None:
                        conds2.append("d.posted_at <= :date_to")
                        params2["date_to"] = den
                    where_sql2 = (" WHERE " + " AND ".join(conds2)) if conds2 else ""
                    params2["limit"] = limit
                    rows2 = await db.execute(text(f"""
                        SELECT
                            d.source, d.source_job_id, d.title, d.company_name,
                            d.city_canonical, d.job_level, d.job_category,
                            d.posted_at, d.source_url,
                            d.job_description_text, d.job_requirement_text,
                            d.primary_address, d.city_raw_vi
                        FROM dbt_dev_silver.silver_job_detail d
                        {where_sql2}
                        ORDER BY d.posted_at DESC NULLS LAST, d.source, d.source_job_id
                        LIMIT :limit
                    """), params2)
                    raw_rows = list(rows2.mappings())
                except Exception:
                    await db.rollback()
                    raw_rows = []
            for r in raw_rows:
                ws.append([
                    r.get("source"),
                    str(r.get("source_job_id") or ""),
                    r.get("title"),
                    r.get("company_name"),
                    r.get("city_canonical"),
                    r.get("job_level"),
                    r.get("job_category"),
                    r.get("posted_at").isoformat() if hasattr(r.get("posted_at"), "isoformat") and r.get("posted_at") else r.get("posted_at"),
                    r.get("source_url"),
                    _strip_pii(r.get("job_description_text") or ""),
                    _strip_pii(r.get("job_requirement_text") or ""),
                    _strip_pii(r.get("primary_address") or ""),
                    r.get("city_raw_vi"),
                ])

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    if kind == "raw":
        filename = f'TalentPulse_RawJD_{category or "All"}_{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.xlsx'
    else:
        filename = f'TalentPulse_Pro_{category or "All"}_{datetime.now(timezone.utc).strftime("%Y-%m-%d")}.xlsx'
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/report")
async def report(
    category: str | None = Query(None),
    city: str | None = Query(None),
    date_from: str | None = Query(None, description="Filter from date YYYY-MM-DD"),
    date_to: str | None = Query(None, description="Filter to date YYYY-MM-DD"),
    user: User = Depends(require_pro),
    db: AsyncSession = Depends(get_db),
):
    tu, den = _khoang_ngay_pro(date_from, date_to)
    # validate early even if not used in subcalls? keep for 422 on bad dates
    skills = await skills_top(category, city, 10, date_from, date_to, user, db)
    tools = await tools_top(category, city, 10, date_from, date_to, user, db)
    languages = await languages_top(category, city, 10, date_from, date_to, user, db)
    benefits = await benefits_top(category, city, 10, date_from, date_to, user, db)
    experience = await experience_dist(category, city, date_from, date_to, user, db)

    # missing stats for data_note (respect date filter if provided)
    try:
        if tu is not None or den is not None:
            conds = ["length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"]
            params: dict = {}
            if tu is not None:
                conds.append("posted_at >= :date_from")
                params["date_from"] = tu
            if den is not None:
                conds.append("posted_at <= :date_to")
                params["date_to"] = den
            where_sql = " AND ".join(conds)
            total = (await db.execute(text(f"SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE {where_sql}"), params)).scalar() or 0
        else:
            total = (await db.execute(text("SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"))).scalar() or 0
    except Exception:
        await db.rollback()
        total = 0
    try:
        if tu is not None or den is not None:
            conds2: list[str] = []
            params2: dict = {}
            if tu is not None:
                conds2.append("extracted_at >= :date_from")
                params2["date_from"] = tu
            if den is not None:
                conds2.append("extracted_at <= :date_to")
                params2["date_to"] = den
            where2 = (" WHERE " + " AND ".join(conds2)) if conds2 else ""
            extracted = (await db.execute(text(f"SELECT count(*) FROM app.jd_insight{where2}"), params2)).scalar() or 0
        else:
            extracted = (await db.execute(text("SELECT count(*) FROM app.jd_insight"))).scalar() or 0
    except Exception:
        await db.rollback()
        extracted = 0
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
    # city/period context for B5 audit — keep English template but surface filters
    city_ctx = f" in {city}" if city else ""
    period_ctx = ""
    if date_from or date_to:
        period_ctx = f" [{date_from or '...'} → {date_to or '...'}]"
    narrative = f"Top 3 skills for {category or 'All'}{city_ctx}{period_ctx}: {top_skills_str}. Top tools: {top_tools_str}."
    if gap_days is not None:
        narrative += f" Gap days: {gap_days}."
    # explicit city/period sentences for i18n readability (audit B5)
    if city:
        narrative += f" City: {city}."
    if date_from or date_to:
        narrative += f" Period: {date_from or 'start'} to {date_to or 'now'}."

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "category": category,
        "city": city,
        "date_from": date_from,
        "date_to": date_to,
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


@router.get("/jobs/{source}/{source_job_id}/raw")
async def job_raw(source: str, source_job_id: str, user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    try:
        row = (
            await db.execute(
                text(
                    """
                    SELECT
                        d.job_description_text,
                        d.job_requirement_text,
                        d.source_url,
                        f.title,
                        f.company_name
                    FROM dbt_dev_silver.silver_job_detail d
                    LEFT JOIN dbt_dev_gold.fct_jobs_daily f
                        ON f.source = d.source AND f.source_job_id = d.source_job_id
                    WHERE d.source = :source AND d.source_job_id::text = :source_job_id
                    LIMIT 1
                    """
                ),
                {"source": source, "source_job_id": source_job_id},
            )
        ).mappings().first()
    except Exception:
        await db.rollback()
        raise HTTPException(404, "Khong tim thay JD goc")
    if row is None:
        raise HTTPException(404, "Khong tim thay JD goc")
    return {
        "source": source,
        "source_job_id": source_job_id,
        "title": row.get("title"),
        "company_name": row.get("company_name"),
        "source_url": row.get("source_url"),
        "job_description_text": _strip_pii(row.get("job_description_text") or ""),
        "job_requirement_text": _strip_pii(row.get("job_requirement_text") or ""),
    }
