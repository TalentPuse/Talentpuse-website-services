"""Client chi doc cho Umami API (self-hosted).

Moi kieu that bai deu gom ve dung mot exception UmamiUnavailable, de caller chi
phai catch mot thu. TUYET DOI khong nuot loi roi tra ve 0: so 0 nghia la "API
chet" trong khi nhin y het so 0 nghia la "khong ai truy cap" — admin se thay
traffic tut ve 0 va di dieu tra sai huong ca ngay, do la cach mot dashboard bat
dau noi doi.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.core.config import UMAMI_API_KEY, UMAMI_BASE_URL, UMAMI_WEBSITE_ID

logger = logging.getLogger(__name__)

# 5s: endpoint nay nam trong request cua trang admin. Khong dat timeout thi
# httpx cho vo han, mot Umami treo se giu worker cua FastAPI cho den khi het
# worker va CA backend ngung phuc vu — chi vi mot widget thong ke.
TIMEOUT_SECONDS = 5.0

# Test ghi de bang httpx.MockTransport. De None trong runtime = dung transport
# mac dinh cua httpx.
_transport: httpx.AsyncBaseTransport | None = None


class UmamiUnavailable(Exception):
    """Umami khong tra loi duoc, hoac tra ve thu ta khong parse noi."""


@dataclass(frozen=True)
class TrafficStats:
    pageviews: int
    visitors: int
    visits: int
    bounce_rate: float


@dataclass(frozen=True)
class SourceRow:
    name: str
    visitors: int


def _ms(dt: datetime) -> int:
    """Umami nhan moc thoi gian bang epoch milliseconds."""
    return int(dt.timestamp() * 1000)


async def _get(path: str, params: dict) -> dict | list:
    """GET mot endpoint Umami, moi loi -> UmamiUnavailable.

    CO Y khong raise luc import: config thieu chi duoc lam hong trang analytics,
    khong duoc lam app khong boot duoc.

    Nhung khi da CHAC CHAN thieu cau hinh thi hong NGAY, dung cho het timeout.
    Mot request khong the thanh cong van ton du 5 giay, va trang admin goi vai
    nguon — admin ngoi nhin spinner hang chuc giay roi moi thay bao loi, dai hon
    nhieu so voi mot dong "chua cau hinh Umami" hien ra tuc thi.
    """
    if not UMAMI_WEBSITE_ID:
        raise UmamiUnavailable("UMAMI_WEBSITE_ID chua duoc cau hinh")

    url = f"{UMAMI_BASE_URL.rstrip('/')}{path}"
    headers = {"x-umami-api-key": UMAMI_API_KEY} if UMAMI_API_KEY else {}
    try:
        # Doc `_transport` tai day (khong phai lam default cua tham so) de
        # monkeypatch trong test co hieu luc.
        async with httpx.AsyncClient(
            timeout=TIMEOUT_SECONDS, transport=_transport
        ) as client:
            resp = await client.get(url, params=params, headers=headers)
    except Exception as exc:
        # Bat Exception rong co chu dich: timeout, DNS hong, TLS hong, connect
        # refused — voi caller thi deu la "khong co so lieu", khong loai nao
        # dang de vo len thanh HTTP 500 cua trang admin.
        logger.warning("Umami request %s failed: %s", path, exc)
        raise UmamiUnavailable(f"request to {path} failed: {exc}") from exc

    if resp.status_code != 200:
        # Gom ca 429 (rate limit) vao day: retry o tang nay se lam Umami nghen
        # them; cache o tang tren moi la cho xu ly dung.
        logger.warning("Umami %s returned HTTP %s", path, resp.status_code)
        raise UmamiUnavailable(f"{path} returned HTTP {resp.status_code}")

    try:
        return resp.json()
    except Exception as exc:
        raise UmamiUnavailable(f"{path} returned non-JSON body") from exc


async def fetch_traffic(start: datetime, end: datetime) -> TrafficStats:
    data = await _get(
        f"/api/websites/{UMAMI_WEBSITE_ID}/stats",
        {"startAt": _ms(start), "endAt": _ms(end)},
    )
    try:
        pageviews = int(data["pageviews"]["value"])
        visitors = int(data["visitors"]["value"])
        visits = int(data["visits"]["value"])
        bounces = int(data["bounces"]["value"])
    except (KeyError, TypeError, ValueError) as exc:
        # Umami doi shape giua cac ban major. Neu chi .get(...) roi mac dinh 0,
        # dashboard se hien 0 lang le sau moi lan nang cap Umami va khong ai
        # biet la no hong.
        raise UmamiUnavailable(f"unexpected stats payload: {data!r}") from exc

    # visits == 0 -> chia 0. Tra 0.0 o day la dung nghia: khong co phien nao
    # thi khong co ti le thoat.
    bounce_rate = (bounces / visits) if visits else 0.0
    return TrafficStats(
        pageviews=pageviews, visitors=visitors, visits=visits, bounce_rate=bounce_rate
    )


async def fetch_sources(start: datetime, end: datetime) -> list[SourceRow]:
    data = await _get(
        f"/api/websites/{UMAMI_WEBSITE_ID}/metrics",
        {"startAt": _ms(start), "endAt": _ms(end), "type": "referrer"},
    )
    if not isinstance(data, list):
        raise UmamiUnavailable(f"unexpected metrics payload: {data!r}")
    try:
        # row["x"] rong = truy cap truc tiep (go URL / bookmark), khong phai
        # thieu du lieu — doi ten thanh "direct" thay vi bo dong do di.
        return [
            SourceRow(name=row["x"] or "direct", visitors=int(row["y"]))
            for row in data
        ]
    except (KeyError, TypeError, ValueError) as exc:
        raise UmamiUnavailable(f"unexpected metrics rows: {data!r}") from exc
