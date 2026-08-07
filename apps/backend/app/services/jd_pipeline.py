"""Pipeline extract JD insight hang ngay."""
from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.jd_extract import ExtractError, extract_insight
from app.services.jd_insight_repo import get_missing_job_keys, upsert_insight

logger = logging.getLogger(__name__)


async def get_jd_text(db: AsyncSession, source: str, source_job_id: str) -> str:
    row = (await db.execute(text("""
        SELECT coalesce(d.job_description_text, '') || ' ' || coalesce(d.job_requirement_text, '')
        FROM dbt_dev_silver.silver_job_detail d
        WHERE d.source = :src AND d.source_job_id = :sjid
    """), {"src": source, "sjid": source_job_id})).scalar_one_or_none()
    return (row or "").strip()


async def run_extract_pipeline(db: AsyncSession, limit: int = 50) -> int:
    """Extract toi da `limit` job chua co insight. Tra so job thanh cong."""
    keys = await get_missing_job_keys(db, limit=limit)
    ok = 0
    for source, sjid in keys:
        try:
            text_jd = await get_jd_text(db, source, sjid)
            if not text_jd:
                continue
            data = await extract_insight(text_jd, source=source, source_job_id=sjid)
            await upsert_insight(db, source, sjid, data)
            ok += 1
        except ExtractError:
            logger.warning("extract fail %s/%s (sai format)", source, sjid)
        except Exception:
            logger.exception("extract fail %s/%s", source, sjid)
    return ok
