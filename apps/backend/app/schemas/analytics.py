from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class Block(BaseModel):
    """Mot nhom metric, kem NGUON va do tin cay cua no.

    `status` la truong bat buoc chu khong phai tuy chon: khong co no, mot nguon
    chet se tra ve so 0 va nguoi doc khong cach nao phan biet "khong ai truy cap"
    voi "he thong do dem hong".
    """

    source: Literal["umami", "postgres", "cloudflare"]
    status: Literal["ok", "error"]
    data: Any | None = None
    error: str | None = None


class AnalyticsOverview(BaseModel):
    traffic: Block
    sources: Block
    activity: Block
    funnel: Block
    cohorts: Block
