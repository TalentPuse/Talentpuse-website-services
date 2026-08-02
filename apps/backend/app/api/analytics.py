"""Admin analytics overview.

Moi nguon duoc lay doc lap va bao cao kem trang thai rieng. Mot nguon chet KHONG
duoc phep lam trang trang hay lam khong so cua nhung nguon con lai, va mot nguon
khong voi toi duoc phai hien ra la LOI — khong bao gio la so 0.

Thu tu trong handler co chu y: goi Umami (HTTP ra ngoai) TRUOC, roi moi cham DB.
`get_db` chi mo session chu chua lay connection ra khoi pool; connection chi bi
chiem tu lenh execute dau tien. Neu dao thu tu — query DB roi moi goi Umami — thi
moi request se ghim mot connection suot 5 giay timeout cua Umami, ma pool chi co
`pool_size=5, max_overflow=0`: nam admin mo trang cung luc la ca app het
connection, ke ca duong dang nhap.
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_get_json, cache_set_json
from app.core.database import get_db
from app.core.security import require_admin
from app.models.user import User
from app.schemas.analytics import AnalyticsOverview, Block
from app.services.analytics.product_metrics import (
    activation_funnel,
    active_users,
    retention_cohorts,
)
from app.services.analytics.umami_client import (
    UmamiUnavailable,
    fetch_sources,
    fetch_traffic,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin/analytics", tags=["analytics"])

CACHE_TTL_SECONDS = 600
UMAMI_DOWN_MESSAGE = "Umami không phản hồi"
VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("/overview", response_model=AnalyticsOverview)
async def overview(
    days: int = Query(30, ge=1, le=365),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsOverview:
    cache_key = f"analytics:overview:{days}"
    cached = await cache_get_json(cache_key)
    if cached is not None:
        return AnalyticsOverview(**cached)

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    try:
        traffic = Block(
            source="umami", status="ok", data=asdict(await fetch_traffic(start, end))
        )
    except UmamiUnavailable as exc:
        logger.warning("umami traffic unavailable: %s", exc)
        traffic = Block(source="umami", status="error", error=UMAMI_DOWN_MESSAGE)

    try:
        rows = await fetch_sources(start, end)
        sources = Block(source="umami", status="ok", data=[asdict(r) for r in rows])
    except UmamiUnavailable as exc:
        logger.warning("umami sources unavailable: %s", exc)
        sources = Block(source="umami", status="error", error=UMAMI_DOWN_MESSAGE)

    # Ngay "hom nay" phai la ngay lich VIET NAM, khong phai `date.today()` cua
    # tien trinh: tren server prod chay gio UTC, tu 00:00 den 07:00 gio VN
    # `date.today()` van tra ve ngay HOM QUA, va DAU tren dashboard se bang 0 moi
    # sang som cho den 7 gio.
    today_vn = datetime.now(VN_TZ).date()

    activity = Block(
        source="postgres",
        status="ok",
        data=asdict(await active_users(db, today_vn)),
    )
    funnel = Block(
        source="postgres", status="ok", data=asdict(await activation_funnel(db))
    )
    cohorts = Block(
        source="postgres",
        status="ok",
        data=[asdict(c) for c in await retention_cohorts(db)],
    )

    result = AnalyticsOverview(
        traffic=traffic,
        sources=sources,
        activity=activity,
        funnel=funnel,
        cohorts=cohorts,
    )

    # Chi cache khi MOI nguon deu khoe. Cache mot response loi nghia la Umami
    # song lai luc 10:01 nhung dashboard con bao "khong phan hoi" den 10:10 —
    # nguoi truc se di dieu tra mot su co da het tu lau.
    if traffic.status == "ok" and sources.status == "ok":
        await cache_set_json(
            cache_key, result.model_dump(mode="json"), CACHE_TTL_SECONDS
        )

    return result
