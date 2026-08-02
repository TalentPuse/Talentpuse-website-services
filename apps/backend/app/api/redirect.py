"""Click-tracking redirect cho job alert.

CO Y khong yeu cau dang nhap: link nay duoc mo tu tin Telegram hoac tu ung dung
email, nhung noi khong mang theo session nao ca. Id la UUID ngau nhien, va thu
duy nhat ke doan trung duoc la lam phong mot bo dem click.

Quy tac xuyen suot file: NGUOI DUNG PHAI DEN DUOC TIN TUYEN DUNG. Moi truc trac
o khau do dem (id la, warehouse khong tra ve url, DB ghi hong) deu ket thuc bang
mot 302 ve trang viec lam, khong bao gio bang 500. Mot link cu trong email vai
thang truoc ma dan vao trang loi thi mat luon nguoi dung do.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import RedirectResponse
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.alert_log import AlertLog

logger = logging.getLogger(__name__)

router = APIRouter(tags=["redirect"])

HOME_URL = "https://talentpuse.io.vn/jobs"


@router.get("/r/{alert_log_id}")
async def track_click(
    alert_log_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> RedirectResponse:
    log = (
        await db.execute(select(AlertLog).where(AlertLog.id == alert_log_id))
    ).scalar_one_or_none()

    if log is None:
        return RedirectResponse(HOME_URL, status_code=302)

    target = (
        await db.execute(
            text(
                """
                SELECT sd.source_url
                FROM dbt_dev_silver.silver_job_detail sd
                WHERE sd.source = :src AND sd.source_job_id = :sjid
                LIMIT 1
                """
            ),
            {"src": log.job_source, "sjid": log.source_job_id},
        )
    ).scalar()

    try:
        # Mot cau UPDATE nguyen tu, KHONG phai doc-roi-ghi trong Python. Mot tin
        # alert co the duoc bam nhieu lan gan nhu cung luc (nguoi dung mo nhieu
        # tab, hoac client email prefetch link). Voi doc-roi-ghi, hai request
        # cung doc click_count = 3 va cung ghi 4 — mat mot click, va bo dem cang
        # sai khi alert cang duoc quan tam.
        #
        # COALESCE giu lan bam DAU TIEN: `clicked_at` la moc de tinh do tre
        # "gui -> bam". Ghi de moi lan bam se pha chi so do vinh vien.
        await db.execute(
            text(
                """
                UPDATE app.alert_logs
                SET click_count = COALESCE(click_count, 0) + 1,
                    clicked_at  = COALESCE(clicked_at, now())
                WHERE id = :id
                """
            ),
            {"id": alert_log_id},
        )
        await db.commit()
    except Exception:
        # Bo dem hong khong duoc phep lam nguoi dung mat cu bam.
        logger.warning("click tracking failed for %s", alert_log_id, exc_info=True)
        await db.rollback()

    return RedirectResponse(target or HOME_URL, status_code=302)
