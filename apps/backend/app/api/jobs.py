from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.jobs import (
    FilterOptions,
    MyAlertList,
    MyAlertRow,
    PublicJobList,
    PublicJobRow,
)

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
