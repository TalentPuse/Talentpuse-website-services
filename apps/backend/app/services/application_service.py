import datetime
import uuid

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_application import APPLICATION_STATUSES, JobApplication

_SNAPSHOT_SQL = text("""
    SELECT f.title, f.company_name, f.city_canonical AS city,
           sd.source_url,
           round((f.salary_vnd_monthly_avg / 1000000.0)::numeric, 1)::float AS salary_million
    FROM dbt_dev_gold.fct_jobs_daily f
    LEFT JOIN dbt_dev_silver.silver_job_detail sd
        ON sd.source = f.source AND sd.source_job_id = f.source_job_id
    WHERE f.source = :source AND f.source_job_id = :sjid
    LIMIT 1
""")


async def snapshot_job(db: AsyncSession, source: str, source_job_id: str) -> dict | None:
    row = (await db.execute(_SNAPSHOT_SQL, {"source": source, "sjid": source_job_id})).mappings().first()
    return dict(row) if row else None


async def _find_internal(db, user_id, source, source_job_id):
    if source_job_id is None:
        return None
    q = select(JobApplication).where(
        JobApplication.user_id == user_id,
        JobApplication.source == source,
        JobApplication.source_job_id == source_job_id,
    )
    return (await db.execute(q)).scalar_one_or_none()


async def create_application(
    db: AsyncSession, user_id: uuid.UUID, *, source: str, source_job_id: str | None = None,
    title: str | None = None, company_name: str | None = None, city: str | None = None,
    source_url: str | None = None, salary_million: float | None = None,
    status: str = "applied", applied_at: datetime.date | None = None, notes: str | None = None,
) -> JobApplication:
    if status not in APPLICATION_STATUSES:
        raise ValueError(f"invalid status: {status}")
    existing = await _find_internal(db, user_id, source, source_job_id)
    if existing is not None:
        return existing
    if source_job_id is not None:  # internal → snapshot
        snap = await snapshot_job(db, source, source_job_id)
        if snap is None:
            raise LookupError("job_not_found")
        title, company_name, city = snap["title"], snap["company_name"], snap["city"]
        source_url, salary_million = snap["source_url"], snap["salary_million"]
    if not title:
        raise ValueError("title_required")
    if status == "applied" and applied_at is None:
        applied_at = datetime.date.today()
    app = JobApplication(
        user_id=user_id, source=source, source_job_id=source_job_id, title=title,
        company_name=company_name, city=city, source_url=source_url,
        salary_million=salary_million, status=status, applied_at=applied_at, notes=notes,
    )
    db.add(app)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await _find_internal(db, user_id, source, source_job_id)
        if existing is not None:
            return existing
        raise
    await db.refresh(app)
    return app


async def list_applications(db, user_id, status: str | None = None) -> list[JobApplication]:
    q = select(JobApplication).where(JobApplication.user_id == user_id)
    if status:
        q = q.where(JobApplication.status == status)
    return list((await db.execute(q.order_by(JobApplication.created_at.desc()))).scalars().all())


async def get_stats(db, user_id) -> dict:
    rows = (await db.execute(
        select(JobApplication.status, func.count()).where(JobApplication.user_id == user_id)
        .group_by(JobApplication.status)
    )).all()
    by_status = {s: 0 for s in APPLICATION_STATUSES}
    for status, count in rows:
        by_status[status] = count
    week_ago = datetime.date.today() - datetime.timedelta(days=7)
    applied_this_week = (await db.execute(
        select(func.count()).where(
            JobApplication.user_id == user_id,
            JobApplication.applied_at.isnot(None),
            JobApplication.applied_at >= week_ago,
        )
    )).scalar() or 0
    return {"total": sum(by_status.values()), "by_status": by_status, "applied_this_week": applied_this_week}


async def tracked_keys(db, user_id) -> list[dict]:
    rows = (await db.execute(
        select(JobApplication.source, JobApplication.source_job_id).where(
            JobApplication.user_id == user_id, JobApplication.source_job_id.isnot(None),
        )
    )).all()
    return [{"source": s, "source_job_id": j} for s, j in rows]


async def update_application(db, user_id, app_id, *, status=None, notes=None, applied_at=None):
    app = (await db.execute(
        select(JobApplication).where(JobApplication.id == app_id, JobApplication.user_id == user_id)
    )).scalar_one_or_none()
    if app is None:
        return None
    if status is not None:
        if status not in APPLICATION_STATUSES:
            raise ValueError("invalid status")
        app.status = status
    if notes is not None:
        app.notes = notes
    if applied_at is not None:
        app.applied_at = applied_at
    await db.commit()
    await db.refresh(app)
    return app


async def delete_application(db, user_id, app_id) -> bool:
    app = (await db.execute(
        select(JobApplication).where(JobApplication.id == app_id, JobApplication.user_id == user_id)
    )).scalar_one_or_none()
    if app is None:
        return False
    await db.delete(app)
    await db.commit()
    return True
