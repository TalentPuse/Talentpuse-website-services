"""Pipeline extract JD insight hang ngay."""
from __future__ import annotations

import asyncio
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


async def run_extract_pipeline(db: AsyncSession, limit: int = 50, concurrency: int = 5) -> int:
    """Extract toi da `limit` job chua co insight. Tra so job thanh cong.

    LLM goi song song (`concurrency`) nhung DB doc/ghi giu tuan tu tren cung
    session — tranh chia se AsyncSession giua cac coroutine.
    """
    keys = await get_missing_job_keys(db, limit=limit)
    if not keys:
        return 0

    rows = []
    for source, sjid in keys:
        text_jd = await get_jd_text(db, source, sjid)
        if text_jd:
            rows.append((source, sjid, text_jd))

    sem = asyncio.Semaphore(concurrency)

    async def _extract_one(row: tuple[str, str, str]) -> dict | None:
        source, sjid, text_jd = row
        try:
            async with sem:
                return await extract_insight(text_jd, source=source, source_job_id=sjid)
        except ExtractError:
            logger.warning("extract fail %s/%s (sai format)", source, sjid)
            return None
        except Exception:
            logger.exception("extract fail %s/%s", source, sjid)
            return None

    ok = 0
    for i in range(0, len(rows), concurrency):
        chunk = rows[i:i + concurrency]
        results = await asyncio.gather(*(_extract_one(r) for r in chunk))
        for (source, sjid, _), data in zip(chunk, results):
            if data is None:
                continue
            try:
                await upsert_insight(db, source, sjid, data)
                ok += 1
            except Exception:
                await db.rollback()
                logger.exception("upsert fail %s/%s", source, sjid)
    return ok
