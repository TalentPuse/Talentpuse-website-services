"""Tests cho client doc Umami API.

Toan bo HTTP bi thay bang httpx.MockTransport nen test khong can Umami that,
khong can mang, khong can DB. Neu mot ngay nao do test o day treo 5 giay roi
fail, gan nhu chac chan la `_transport` khong duoc client dung toi nua va
request that su di ra ngoai internet.
"""
from datetime import datetime, timezone

import httpx
import pytest

from app.services.analytics import umami_client
from app.services.analytics.umami_client import UmamiUnavailable, fetch_traffic

START = datetime(2026, 7, 1, tzinfo=timezone.utc)
END = datetime(2026, 7, 31, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _da_cau_hinh(monkeypatch):
    """Mac dinh coi nhu Umami DA duoc cau hinh.

    `UMAMI_WEBSITE_ID` duoc import vao module luc load, nen patch
    `app.core.config` khong an — phai patch chinh ten trong `umami_client`.

    Khong co fixture nay, moi test o day chay voi website id RONG va di vao
    nhanh fast-fail — chung se "pass" ma khong he cham toi doan parse payload
    hay xu ly HTTP nao ca.
    """
    monkeypatch.setattr(umami_client, "UMAMI_WEBSITE_ID", "test-website-id")


async def test_fetch_traffic_parses_umami_payload(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "pageviews": {"value": 1234},
                "visitors": {"value": 567},
                "visits": {"value": 890},
                "bounces": {"value": 445},
            },
        )

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    stats = await fetch_traffic(START, END)

    assert stats.pageviews == 1234
    assert stats.visitors == 567
    assert stats.visits == 890
    assert stats.bounce_rate == pytest.approx(0.5)


async def test_fetch_traffic_raises_on_500(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


async def test_fetch_traffic_raises_on_429(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="slow down")

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


async def test_fetch_traffic_raises_on_timeout(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


async def test_fetch_traffic_raises_on_malformed_payload(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


async def test_hong_ngay_khi_chua_cau_hinh(monkeypatch):
    """Thieu cau hinh thi bao ngay, khong ngoi cho het timeout.

    Mot request khong the thanh cong van ton du 5 giay. Trang admin goi vai
    nguon, nen admin nhin spinner hang chuc giay roi moi thay bao loi — trong
    khi cau tra loi da biet chac tu dau.

    `_transport` co tinh de nguyen: neu fast-fail khong chay, request that se
    di ra ngoai va test treo — do chinh la tin hieu can bat.
    """
    monkeypatch.setattr(umami_client, "UMAMI_WEBSITE_ID", "")

    with pytest.raises(UmamiUnavailable, match="chua duoc cau hinh"):
        await fetch_traffic(START, END)
