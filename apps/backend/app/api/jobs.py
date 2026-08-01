from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.jobs import (
    FilterOptions,
    JobDetail,
    JobMatch,
    MyAlertList,
    MyAlertRow,
    PublicJobList,
    PublicJobRow,
)
from app.services.job_fit import score_jobs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=PublicJobList)
async def list_jobs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    search: str | None = Query(None),
    city: str | None = Query(None),
    level: str | None = Query(None),
    source: str | None = Query(None),
    has_salary: bool | None = Query(None),
    category: str | None = Query(None),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublicJobList:
    conditions: list[str] = []
    params: dict = {}

    if search:
        conditions.append("(f.title ILIKE :search OR f.company_name ILIKE :search)")
        params["search"] = f"%{search}%"
    if city:
        conditions.append("f.city_canonical = :city")
        params["city"] = city
    if level:
        conditions.append("f.job_level = :level")
        params["level"] = level
    if source:
        conditions.append("f.source = :source")
        params["source"] = source
    if has_salary is True:
        conditions.append("f.salary_vnd_monthly_avg IS NOT NULL")
    elif has_salary is False:
        conditions.append("f.salary_vnd_monthly_avg IS NULL")
    if category:
        conditions.append("f.job_category = :category")
        params["category"] = category

    where_extra = (" AND " + " AND ".join(conditions)) if conditions else ""

    count_result = await db.execute(
        text(f"""
            SELECT count(DISTINCT (f.source, f.source_job_id))
            FROM dbt_dev_gold.fct_jobs_daily f
            WHERE f.is_active {where_extra}
        """),
        params,
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    params["limit"] = per_page
    params["offset"] = offset

    # `silver_skill_long` nằm ở kho dbt, không phải schema app, nên nó có thể CHƯA
    # được build (dbt chạy thiếu model) trong khi `fct_jobs_daily` đã đầy dữ liệu.
    # LEFT JOIN vào một bảng không tồn tại làm hỏng CẢ câu lệnh ⇒ trang Việc làm
    # trả 500 và trắng trơn, dù 900+ job vẫn nằm sẵn trong kho.
    #
    # Ở đây skill chỉ là phần làm giàu — LEFT JOIN kèm COALESCE về mảng rỗng đã tự
    # tuyên bố nó là tùy chọn. Nên thiếu bảng thì hiện job KHÔNG có tag skill, đúng
    # như khi job không có skill nào, chứ không phải sập cả trang.
    #
    # `to_regclass` chỉ tra catalog nên rẻ, và CỐ Ý không cache: dbt build bảng đó
    # giữa chừng thì request kế tiếp tự có skill trở lại, không cần restart.
    has_skill_table = bool(
        (
            await db.execute(text("SELECT to_regclass('dbt_dev_silver.silver_skill_long') IS NOT NULL"))
        ).scalar()
    )
    if has_skill_table:
        skills_select = """COALESCE(
                array_agg(DISTINCT sk.skill_name_norm)
                    FILTER (WHERE sk.skill_name_norm IS NOT NULL),
                ARRAY[]::text[]
            ) AS skills"""
        skills_join = """LEFT JOIN dbt_dev_silver.silver_skill_long sk
            ON sk.source = f.source AND sk.source_job_id = f.source_job_id"""
    else:
        logger.warning("silver_skill_long missing; serving jobs without skill tags")
        skills_select = "ARRAY[]::text[] AS skills"
        skills_join = ""

    result = await db.execute(text(f"""
        SELECT
            f.source,
            f.source_job_id,
            f.title,
            f.company_name,
            f.city_canonical,
            f.job_level,
            f.job_category,
            round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
            sd.source_url,
            f.posted_at,
            {skills_select}
        FROM dbt_dev_gold.fct_jobs_daily f
        LEFT JOIN dbt_dev_silver.silver_job_detail sd
            ON sd.source = f.source AND sd.source_job_id = f.source_job_id
        {skills_join}
        WHERE f.is_active {where_extra}
        GROUP BY f.source, f.source_job_id, f.title, f.company_name,
                 f.city_canonical, f.job_level, f.job_category,
                 f.salary_vnd_monthly_avg, sd.source_url, f.posted_at
        ORDER BY f.posted_at DESC NULLS LAST
        LIMIT :limit OFFSET :offset
    """), params)

    jobs = [
        PublicJobRow(
            source=row["source"],
            source_job_id=row["source_job_id"],
            title=row["title"],
            company_name=row["company_name"],
            city_canonical=row["city_canonical"],
            job_level=row["job_level"],
            job_category=row["job_category"],
            salary_million=row["salary_million"],
            source_url=row["source_url"],
            posted_at=row["posted_at"],
            skills=row["skills"] or [],
        )
        for row in result.mappings()
    ]

    return PublicJobList(jobs=jobs, total=total, page=page, per_page=per_page)


@router.get("/filters", response_model=FilterOptions)
async def get_filters(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FilterOptions:
    result = await db.execute(text("""
        SELECT
            array_agg(DISTINCT f.city_canonical ORDER BY f.city_canonical)
                FILTER (WHERE f.city_canonical IS NOT NULL) AS cities,
            array_agg(DISTINCT f.job_level ORDER BY f.job_level)
                FILTER (WHERE f.job_level IS NOT NULL) AS levels,
            array_agg(DISTINCT f.source ORDER BY f.source)
                FILTER (WHERE f.source IS NOT NULL) AS sources,
            array_agg(DISTINCT f.job_category ORDER BY f.job_category)
                FILTER (WHERE f.job_category IS NOT NULL) AS categories
        FROM dbt_dev_gold.fct_jobs_daily f
        WHERE f.is_active
    """))
    row = result.mappings().first()
    return FilterOptions(
        cities=row["cities"] or [],
        levels=row["levels"] or [],
        sources=row["sources"] or [],
        categories=row["categories"] or [],
    )


@router.get("/my-alerts", response_model=MyAlertList)
async def my_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MyAlertList:
    uid = str(user.id)

    count_result = await db.execute(
        text("SELECT count(DISTINCT source_job_id) FROM app.alert_logs WHERE user_id = :uid"),
        {"uid": uid},
    )
    total = count_result.scalar()

    offset = (page - 1) * per_page
    result = await db.execute(text("""
        SELECT DISTINCT ON (al.source_job_id)
            al.source_job_id,
            f.source,
            f.title,
            f.company_name,
            f.city_canonical,
            round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
            sd.source_url,
            al.sent_at,
            al.channel
        FROM app.alert_logs al
        LEFT JOIN dbt_dev_gold.fct_jobs_daily f
            ON f.source_job_id = al.source_job_id AND f.is_active
        LEFT JOIN dbt_dev_silver.silver_job_detail sd
            ON sd.source = f.source AND sd.source_job_id = f.source_job_id
        WHERE al.user_id = :uid
        ORDER BY al.source_job_id, al.sent_at DESC
        LIMIT :limit OFFSET :offset
    """), {"uid": uid, "limit": per_page, "offset": offset})

    alerts = [
        MyAlertRow(
            source_job_id=row["source_job_id"],
            source=row["source"],
            title=row["title"],
            company_name=row["company_name"],
            city_canonical=row["city_canonical"],
            salary_million=row["salary_million"],
            source_url=row["source_url"],
            sent_at=row["sent_at"],
            channel=row["channel"],
        )
        for row in result.mappings()
    ]

    return MyAlertList(alerts=alerts, total=total, page=page, per_page=per_page)


# DISTINCT ON BAT BUOC: fct_jobs_daily la bang SNAPSHOT HANG NGAY, mot tin co the
# co NHIEU dong is_active=true (mot dong moi snapshot_date). WHERE source+sjid da
# loc dung MOT tin, nhung neu khong khu trung theo snapshot_date thi LIMIT 1 lay
# mot dong BAT KY trong so do — khong xac dinh, va co the la ban CU neu luong/cap
# bac giua cac snapshot khac nhau. Cung cach da ap dung o job_fit/facts.py.
_DETAIL_SQL = text("""
    WITH job AS (
        SELECT DISTINCT ON (f.source, f.source_job_id) f.*
        FROM dbt_dev_gold.fct_jobs_daily f
        WHERE f.source = :source AND f.source_job_id = :sjid AND f.is_active
        ORDER BY f.source, f.source_job_id, f.snapshot_date DESC
    )
    SELECT
        job.source, job.source_job_id, job.title, job.company_name,
        job.city_canonical, job.job_level, job.job_category, job.degree_label,
        job.posted_at, job.expired_at, job.num_of_views, job.num_of_applications,
        round((job.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million,
        round((job.salary_vnd_monthly_min / 1000000.0)::numeric, 1)::float AS salary_min_million,
        round((job.salary_vnd_monthly_max / 1000000.0)::numeric, 1)::float AS salary_max_million,
        d.company_logo_url, d.company_size_label, d.primary_address,
        d.employment_type, d.years_of_experience, d.working_days,
        d.job_description_text, d.job_requirement_text,
        d.benefits, d.skills, d.source_url
    FROM job
    LEFT JOIN dbt_dev_silver.silver_job_detail d
        ON d.source = job.source AND d.source_job_id = job.source_job_id
    LIMIT 1
""")


def _json_labels(raw) -> list[str]:
    """`benefits`/`skills` la jsonb voi hinh dang khong dong nhat giua cac nguon:
    co cho la ["a","b"], co cho la [{"name":"a"}]. Lay nhan doc duoc va bo qua
    phan con lai, thay vi de mot nguon la khien ca panel 500."""
    out: list[str] = []
    if not isinstance(raw, list):
        return out
    for item in raw:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
        elif isinstance(item, dict):
            for key in ("name", "label", "title", "vi", "en"):
                v = item.get(key)
                if isinstance(v, str) and v.strip():
                    out.append(v.strip())
                    break
    return out[:20]


@router.get("/{source}/{source_job_id}", response_model=JobDetail)
async def get_job_detail(
    source: str,
    source_job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> JobDetail:
    row = (await db.execute(
        _DETAIL_SQL, {"source": source, "sjid": source_job_id}
    )).mappings().first()
    if row is None:
        raise HTTPException(404, "Job not found")

    scores = await score_jobs(db, user, [(source, source_job_id)])
    fit = scores.get((source, source_job_id))

    return JobDetail(
        source=row["source"],
        source_job_id=row["source_job_id"],
        title=row["title"],
        company_name=row["company_name"],
        company_logo_url=row["company_logo_url"],
        company_size_label=row["company_size_label"],
        city_canonical=row["city_canonical"],
        primary_address=row["primary_address"],
        job_level=row["job_level"],
        job_category=row["job_category"],
        employment_type=row["employment_type"],
        years_of_experience=row["years_of_experience"],
        working_days=row["working_days"],
        degree_label=row["degree_label"],
        salary_million=row["salary_million"],
        salary_min_million=row["salary_min_million"],
        salary_max_million=row["salary_max_million"],
        description=row["job_description_text"],
        requirement=row["job_requirement_text"],
        benefits=_json_labels(row["benefits"]),
        skills=_json_labels(row["skills"]),
        source_url=row["source_url"],
        posted_at=row["posted_at"],
        expired_at=row["expired_at"],
        num_of_views=row["num_of_views"],
        num_of_applications=row["num_of_applications"],
        match=JobMatch(**fit.__dict__) if fit else None,
    )
