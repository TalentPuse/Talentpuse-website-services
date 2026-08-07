"""Repo jd_insight — upsert, doc, tim job chua extract."""
from __future__ import annotations

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.jd_insight import JdInsight
from app.services.jd_extract import MODEL_VERSION


async def upsert_insight(
    db: AsyncSession, source: str, source_job_id: str, data: dict, model_version: str = MODEL_VERSION
) -> None:
    stmt = pg_insert(JdInsight).values(
        source=source, source_job_id=source_job_id, data=data, model_version=model_version
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_jd_insight_source_job",
        set_={"data": stmt.excluded.data, "model_version": stmt.excluded.model_version,
              "extracted_at": text("now()")},
    )
    await db.execute(stmt)
    await db.commit()


async def get_insight(db: AsyncSession, source: str, source_job_id: str) -> dict | None:
    row = (await db.execute(
        select(JdInsight.data).where(
            JdInsight.source == source, JdInsight.source_job_id == source_job_id
        )
    )).scalar_one_or_none()
    return row


async def get_missing_job_keys(db: AsyncSession, limit: int = 100) -> list[tuple[str, str]]:
    """Cac (source, source_job_id) co JD text nhung CHUA co insight."""
    rows = await db.execute(text("""
        SELECT d.source, d.source_job_id
        FROM dbt_dev_silver.silver_job_detail d
        WHERE length(coalesce(d.job_description_text, '')) > 100
          AND NOT EXISTS (
              SELECT 1 FROM app.jd_insight i
              WHERE i.source = d.source AND i.source_job_id = d.source_job_id
          )
        LIMIT :limit
    """), {"limit": limit})
    return [(r[0], r[1]) for r in rows.all()]
