# Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface traffic, retention, funnel, and product-depth metrics on a new `/admin/analytics` page, and start measuring alert click-through.

**Architecture:** A thin `app/api/analytics.py` router assembles three sources behind one admin-only endpoint: an HTTP client for Umami, SQL over `app.*` + `app.user_activity_daily`, and (later) Cloudflare. Each source is a separate module with one responsibility so it can be tested alone. Every metric carries the name of the source that produced it, and a failed source degrades to an explicit error state rather than a zero.

**Tech Stack:** FastAPI · SQLAlchemy 2.0 async · httpx · Redis cache (`app/core/cache.py`) · Next.js 14 App Router · React · jest + @testing-library/react

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-admin-traffic-analytics-design.md`
- **Depends on** `docs/superpowers/plans/2026-08-02-analytics-foundation.md` being complete: `app.users.last_active_at`, the view `app.user_activity_daily`, and a running Umami with a website ID.
- Alembic head after the foundation plan is `019`. The migration here is **`020`**.
- **All timestamps timezone-aware UTC** (`datetime.now(timezone.utc)`); `datetime.utcnow()` is banned.
- **All per-day grouping uses `DATE(<ts> AT TIME ZONE 'Asia/Ho_Chi_Minh')`.**
- `require_admin` lives at `app/core/security.py:61` and is used as `_admin: User = Depends(require_admin)` (see `app/api/admin.py`).
- Reuse `cache_get_json` / `cache_set_json` from `app/core/cache.py`. Do not add a second cache layer.
- Never hold a DB connection across an outbound HTTP call — the engine is `pool_size=5, max_overflow=0`.
- Frontend test runner is **jest** (`apps/frontend/package.json`); API calls go through `adminApi` in `apps/frontend/lib/api.ts:636`.
- Backend commands run from `apps/backend/`; frontend commands from `apps/frontend/`.

---

### Task 1: Umami HTTP client

**Files:**
- Create: `apps/backend/app/services/analytics/__init__.py` (empty)
- Create: `apps/backend/app/services/analytics/umami_client.py`
- Modify: `apps/backend/app/core/config.py` (three new settings)
- Test: `apps/backend/tests/test_umami_client.py`

**Interfaces:**
- Consumes: `UMAMI_BASE_URL`, `UMAMI_API_KEY`, `UMAMI_WEBSITE_ID` from config.
- Produces:
  - `TrafficStats` dataclass: `pageviews: int`, `visitors: int`, `visits: int`, `bounce_rate: float`
  - `async fetch_traffic(start: datetime, end: datetime) -> TrafficStats`
  - `async fetch_sources(start: datetime, end: datetime) -> list[SourceRow]` where `SourceRow` is `name: str`, `visitors: int`
  - `UmamiUnavailable(Exception)` — raised on timeout, non-2xx, or malformed payload. Task 3 catches it and renders an error state.

- [x] **Step 1: Write the failing tests**

Create `apps/backend/tests/test_umami_client.py`:

```python
from datetime import datetime, timezone

import httpx
import pytest

from app.services.analytics import umami_client
from app.services.analytics.umami_client import UmamiUnavailable, fetch_traffic

START = datetime(2026, 7, 1, tzinfo=timezone.utc)
END = datetime(2026, 7, 31, tzinfo=timezone.utc)


@pytest.mark.asyncio
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


@pytest.mark.asyncio
async def test_fetch_traffic_raises_on_500(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


@pytest.mark.asyncio
async def test_fetch_traffic_raises_on_429(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="slow down")

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


@pytest.mark.asyncio
async def test_fetch_traffic_raises_on_timeout(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timed out", request=request)

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)


@pytest.mark.asyncio
async def test_fetch_traffic_raises_on_malformed_payload(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    monkeypatch.setattr(umami_client, "_transport", httpx.MockTransport(handler))

    with pytest.raises(UmamiUnavailable):
        await fetch_traffic(START, END)
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_umami_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.analytics'`

- [x] **Step 3: Add config settings**

In `apps/backend/app/core/config.py`, next to the other `os.getenv` settings:

```python
UMAMI_BASE_URL = os.getenv("UMAMI_BASE_URL", "http://umami:3000")
UMAMI_API_KEY = os.getenv("UMAMI_API_KEY", "")
UMAMI_WEBSITE_ID = os.getenv("UMAMI_WEBSITE_ID", "")
```

Add the same three keys (empty) to `.env.example`. `UMAMI_API_KEY` is created in the Umami UI under Settings → API keys.

> CHUA LAM: phan `.env.example` bi bo qua co y trong lan chay nay (file do dang bi mot agent khac sua song song). Van con phai them 3 key vao `.env.example`.

- [x] **Step 4: Write the client**

Create `apps/backend/app/services/analytics/__init__.py` (empty file), then `apps/backend/app/services/analytics/umami_client.py`:

```python
"""Read-only client for the self-hosted Umami API.

Every failure mode collapses into UmamiUnavailable so callers have exactly one
thing to catch. Never swallow a failure and return zeros: a zero that means
"the API is down" is indistinguishable from a zero that means "nobody visited",
and that is how a dashboard starts lying.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.core.config import UMAMI_API_KEY, UMAMI_BASE_URL, UMAMI_WEBSITE_ID

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 5.0

# Overridden in tests with an httpx.MockTransport.
_transport: httpx.AsyncBaseTransport | None = None


class UmamiUnavailable(Exception):
    """Umami could not answer, or answered something we cannot parse."""


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
    return int(dt.timestamp() * 1000)


async def _get(path: str, params: dict) -> dict | list:
    url = f"{UMAMI_BASE_URL.rstrip('/')}{path}"
    headers = {"x-umami-api-key": UMAMI_API_KEY} if UMAMI_API_KEY else {}
    try:
        async with httpx.AsyncClient(
            timeout=TIMEOUT_SECONDS, transport=_transport
        ) as client:
            resp = await client.get(url, params=params, headers=headers)
    except Exception as exc:
        raise UmamiUnavailable(f"request to {path} failed: {exc}") from exc

    if resp.status_code != 200:
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
        raise UmamiUnavailable(f"unexpected stats payload: {data!r}") from exc

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
        return [
            SourceRow(name=row["x"] or "direct", visitors=int(row["y"]))
            for row in data
        ]
    except (KeyError, TypeError, ValueError) as exc:
        raise UmamiUnavailable(f"unexpected metrics rows: {data!r}") from exc
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_umami_client.py -v`
Expected: all five PASS. (Ket qua thuc te: 5 passed.)

- [x] **Step 6: Commit**

```bash
git add apps/backend/app/services/analytics/ apps/backend/app/core/config.py apps/backend/tests/test_umami_client.py .env.example
git commit -m "feat(analytics): client doc Umami API, moi loi thanh UmamiUnavailable"
```

---

### Task 2: Product metrics from Postgres

**Files:**
- Create: `apps/backend/app/services/analytics/product_metrics.py`
- Test: `apps/backend/tests/test_product_metrics.py`

**Interfaces:**
- Consumes: `app.users`, `app.user_activity_daily` (foundation plan Task 3), `app.alert_logs`, `app.telegram_connections`, `app.alert_subscriptions`.
- Produces:
  - `async active_users(db, on_date: date) -> ActiveUsers` where `ActiveUsers` is `dau: int`, `wau: int`, `mau: int`, `stickiness: float`
  - `async retention_cohorts(db, weeks: int = 8) -> list[CohortRow]` where `CohortRow` is `cohort_week: date`, `size: int`, `d1: float`, `d7: float`, `d30: float`
  - `async activation_funnel(db) -> FunnelSteps` with `signed_up: int`, `profile_completed: int`, `channel_enabled: int`, `alerted: int`

- [x] **Step 1: Write the failing tests**

Create `apps/backend/tests/test_product_metrics.py`:

```python
from datetime import date

import pytest
from sqlalchemy import text

from app.services.analytics import product_metrics


async def _mark_active(db_session, user_id, day: str):
    """Insert a real activity row the view will pick up (a chat room)."""
    await db_session.execute(
        text(
            "INSERT INTO app.chat_rooms (id, user_id, created_at) "
            "VALUES (gen_random_uuid(), :uid, :ts)"
        ),
        {"uid": str(user_id), "ts": f"{day} 05:00:00+00"},
    )
    await db_session.commit()


@pytest.mark.asyncio
async def test_dau_counts_only_the_given_day(db_session, seed_user):
    await _mark_active(db_session, seed_user.id, "2026-07-10")
    await _mark_active(db_session, seed_user.id, "2026-06-01")

    stats = await product_metrics.active_users(db_session, date(2026, 7, 10))

    assert stats.dau == 1


@pytest.mark.asyncio
async def test_wau_covers_the_trailing_seven_days(db_session, seed_user):
    await _mark_active(db_session, seed_user.id, "2026-07-05")

    stats = await product_metrics.active_users(db_session, date(2026, 7, 10))

    assert stats.dau == 0
    assert stats.wau == 1
    assert stats.mau == 1


@pytest.mark.asyncio
async def test_stickiness_is_dau_over_mau(db_session, seed_user):
    await _mark_active(db_session, seed_user.id, "2026-07-10")

    stats = await product_metrics.active_users(db_session, date(2026, 7, 10))

    assert stats.stickiness == pytest.approx(1.0)


@pytest.mark.asyncio
async def test_stickiness_is_zero_when_nobody_is_active(db_session):
    stats = await product_metrics.active_users(db_session, date(2026, 7, 10))

    assert stats.dau == 0
    assert stats.mau == 0
    assert stats.stickiness == 0.0  # must not raise ZeroDivisionError


@pytest.mark.asyncio
async def test_funnel_counts_are_monotonically_non_increasing(db_session, seed_user):
    funnel = await product_metrics.activation_funnel(db_session)

    assert funnel.signed_up >= funnel.profile_completed
    assert funnel.profile_completed >= funnel.channel_enabled
    assert funnel.channel_enabled >= 0
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_product_metrics.py -v`
Expected: FAIL — `product_metrics` does not exist.

- [x] **Step 3: Write the metrics module**

Create `apps/backend/app/services/analytics/product_metrics.py`:

```python
"""Product metrics computed from the operational database.

Every day boundary is the VN calendar day, matching app.user_activity_daily.
Mixing UTC and VN boundaries is the defect this repo has shipped three times
(JA-25, JA-T1, JA-T2) — keep every date expression in this module identical.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

VN = "Asia/Ho_Chi_Minh"


@dataclass(frozen=True)
class ActiveUsers:
    dau: int
    wau: int
    mau: int
    stickiness: float


@dataclass(frozen=True)
class CohortRow:
    cohort_week: date
    size: int
    d1: float
    d7: float
    d30: float


@dataclass(frozen=True)
class FunnelSteps:
    signed_up: int
    profile_completed: int
    channel_enabled: int
    alerted: int


async def active_users(db: AsyncSession, on_date: date) -> ActiveUsers:
    row = (
        await db.execute(
            text(
                """
                SELECT
                  count(DISTINCT user_id) FILTER (
                      WHERE activity_date = :d) AS dau,
                  count(DISTINCT user_id) FILTER (
                      WHERE activity_date > :d - 7 AND activity_date <= :d) AS wau,
                  count(DISTINCT user_id) FILTER (
                      WHERE activity_date > :d - 30 AND activity_date <= :d) AS mau
                FROM app.user_activity_daily
                WHERE was_active
                """
            ),
            {"d": on_date},
        )
    ).mappings().one()

    dau, wau, mau = int(row["dau"]), int(row["wau"]), int(row["mau"])
    return ActiveUsers(
        dau=dau, wau=wau, mau=mau, stickiness=(dau / mau) if mau else 0.0
    )


async def retention_cohorts(db: AsyncSession, weeks: int = 8) -> list[CohortRow]:
    rows = (
        await db.execute(
            text(
                f"""
                WITH cohorts AS (
                    SELECT id AS user_id,
                           date_trunc('week', created_at AT TIME ZONE '{VN}')::date AS cohort_week,
                           DATE(created_at AT TIME ZONE '{VN}') AS joined_on
                    FROM app.users
                    WHERE created_at >= now() - make_interval(weeks => :weeks)
                ),
                acts AS (
                    SELECT c.user_id, c.cohort_week,
                           (a.activity_date - c.joined_on) AS day_offset
                    FROM cohorts c
                    LEFT JOIN app.user_activity_daily a
                      ON a.user_id = c.user_id AND a.was_active
                )
                SELECT cohort_week,
                       count(DISTINCT user_id)                                 AS size,
                       count(DISTINCT user_id) FILTER (WHERE day_offset >= 1)  AS r1,
                       count(DISTINCT user_id) FILTER (WHERE day_offset >= 7)  AS r7,
                       count(DISTINCT user_id) FILTER (WHERE day_offset >= 30) AS r30
                FROM acts
                GROUP BY cohort_week
                ORDER BY cohort_week DESC
                """
            ),
            {"weeks": weeks},
        )
    ).mappings().all()

    out: list[CohortRow] = []
    for r in rows:
        size = int(r["size"]) or 0
        out.append(
            CohortRow(
                cohort_week=r["cohort_week"],
                size=size,
                d1=(int(r["r1"]) / size) if size else 0.0,
                d7=(int(r["r7"]) / size) if size else 0.0,
                d30=(int(r["r30"]) / size) if size else 0.0,
            )
        )
    return out


async def activation_funnel(db: AsyncSession) -> FunnelSteps:
    row = (
        await db.execute(
            text(
                """
                SELECT
                  (SELECT count(*) FROM app.users WHERE is_active)::int AS signed_up,
                  (SELECT count(*) FROM app.users
                     WHERE is_active
                       AND (array_length(skills, 1) > 0
                            OR array_length(desired_titles, 1) > 0))::int AS profile_completed,
                  (SELECT count(DISTINCT u.id) FROM app.users u
                     LEFT JOIN app.telegram_connections t
                            ON t.user_id = u.id AND t.status = 'active'
                     LEFT JOIN app.alert_subscriptions s
                            ON s.user_id = u.id AND s.enabled
                     WHERE u.is_active AND (t.id IS NOT NULL OR s.id IS NOT NULL))::int
                     AS channel_enabled,
                  (SELECT count(DISTINCT user_id) FROM app.alert_logs)::int AS alerted
                """
            )
        )
    ).mappings().one()

    return FunnelSteps(
        signed_up=int(row["signed_up"]),
        profile_completed=int(row["profile_completed"]),
        channel_enabled=int(row["channel_enabled"]),
        alerted=int(row["alerted"]),
    )
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_product_metrics.py -v`
Expected: all five PASS. If `test_stickiness_is_zero_when_nobody_is_active` raises `ZeroDivisionError`, the guard on `mau` was dropped.

- [x] **Step 5: Commit**

```bash
git add apps/backend/app/services/analytics/product_metrics.py apps/backend/tests/test_product_metrics.py
git commit -m "feat(analytics): DAU/WAU/MAU, cohort retention, activation funnel"
```

---

### Task 3: Admin-only analytics endpoint

**Files:**
- Create: `apps/backend/app/api/analytics.py`
- Create: `apps/backend/app/schemas/analytics.py`
- Modify: `apps/backend/app/main.py` (register the router next to the other `include_router` calls)
- Modify: `apps/backend/tests/conftest.py` (add an `admin_auth_headers` fixture)
- Test: `apps/backend/tests/test_analytics_api.py`

**Interfaces:**
- Consumes: `fetch_traffic`, `fetch_sources`, `UmamiUnavailable` (Task 1); `active_users`, `retention_cohorts`, `activation_funnel` (Task 2); `cache_get_json` / `cache_set_json` from `app/core/cache.py`; `require_admin` from `app/core/security.py:61`.
- Produces: `GET /api/admin/analytics/overview?days=30` returning:

```json
{
  "traffic": {"source": "umami", "status": "ok", "data": {"pageviews": 0, "visitors": 0, "visits": 0, "bounce_rate": 0.0}},
  "sources": {"source": "umami", "status": "error", "error": "Umami không phản hồi", "data": null},
  "activity": {"source": "postgres", "status": "ok", "data": {"dau": 0, "wau": 0, "mau": 0, "stickiness": 0.0}},
  "funnel": {"source": "postgres", "status": "ok", "data": {"signed_up": 0, "profile_completed": 0, "channel_enabled": 0, "alerted": 0}},
  "cohorts": {"source": "postgres", "status": "ok", "data": []}
}
```

Every block carries `source` and `status`. `status: "error"` means the number is unknown — **not** zero. This shape is what stops the dashboard from lying.

- [x] **Step 1: Add the `admin_auth_headers` fixture**

In `apps/backend/tests/conftest.py`, read the existing `seed_user` and `auth_headers` fixtures first, then add a fixture that seeds a user with `is_admin=True` and mints a token the same way `auth_headers` does. Name it `admin_auth_headers`.

- [x] **Step 2: Write the failing tests**

Create `apps/backend/tests/test_analytics_api.py`:

```python
import pytest

from app.services.analytics import umami_client


@pytest.mark.asyncio
async def test_requires_authentication(client):
    resp = await client.get("/api/admin/analytics/overview")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_regular_user_gets_403(client, auth_headers):
    resp = await client.get("/api/admin/analytics/overview", headers=auth_headers)
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_umami_failure_becomes_error_status_not_zero(
    client, admin_auth_headers, monkeypatch
):
    async def boom(*args, **kwargs):
        raise umami_client.UmamiUnavailable("down")

    monkeypatch.setattr("app.api.analytics.fetch_traffic", boom)
    monkeypatch.setattr("app.api.analytics.fetch_sources", boom)

    resp = await client.get("/api/admin/analytics/overview", headers=admin_auth_headers)

    assert resp.status_code == 200
    body = resp.json()
    assert body["traffic"]["status"] == "error"
    assert body["traffic"]["data"] is None
    # Postgres-backed blocks are unaffected by Umami being down.
    assert body["activity"]["status"] == "ok"
```

- [x] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_analytics_api.py -v`
Expected: FAIL — 404 on the route.

- [x] **Step 4: Write the response schemas**

Create `apps/backend/app/schemas/analytics.py`:

```python
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class Block(BaseModel):
    """One metric group plus where it came from and whether it is trustworthy."""

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
```

- [x] **Step 5: Write the router**

Create `apps/backend/app/api/analytics.py`:

```python
"""Admin analytics overview.

Each source is fetched independently and reported with its own status. One
source failing must never zero out or hide the others, and an unreachable
source is reported as an error — never as the number 0.
"""
from __future__ import annotations

import logging
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone

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

    activity = Block(
        source="postgres",
        status="ok",
        data=asdict(await active_users(db, date.today())),
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

    # Only cache a fully healthy response — caching an error would keep the
    # dashboard broken for 10 minutes after the source recovers.
    if traffic.status == "ok" and sources.status == "ok":
        await cache_set_json(cache_key, result.model_dump(mode="json"), CACHE_TTL_SECONDS)

    return result
```

- [x] **Step 6: Register the router**

In `apps/backend/app/main.py`, next to the existing `app.include_router(...)` calls:

```python
from app.api import analytics

app.include_router(analytics.router)
```

- [x] **Step 7: Run tests to verify they pass**

Run: `pytest tests/test_analytics_api.py -v`
Expected: all three PASS. The third is the important one — a dead Umami must produce `status: "error"`, never `0`.

- [x] **Step 8: Commit**

```bash
git add apps/backend/app/api/analytics.py apps/backend/app/schemas/analytics.py apps/backend/app/main.py apps/backend/tests/test_analytics_api.py apps/backend/tests/conftest.py
git commit -m "feat(analytics): endpoint /api/admin/analytics/overview, moi khoi co nguon + trang thai"
```

---

### Task 4: `/admin/analytics` page

**Files:**
- Create: `apps/frontend/app/admin/analytics/page.tsx`
- Create: `apps/frontend/components/admin/MetricBlock.tsx`
- Modify: `apps/frontend/lib/api.ts` (add `analyticsOverview` to `adminApi`, around line 636)
- Modify: `apps/frontend/components/admin/AdminSidebar.tsx` (add the nav link)
- Test: `apps/frontend/__tests__/admin/MetricBlock.test.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/analytics/overview` (Task 3).
- Produces: a page rendering five blocks, each showing its data source, and an explicit error panel when `status === "error"`.

- [x] **Step 1: Write the failing test**

Create `apps/frontend/__tests__/admin/MetricBlock.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import MetricBlock from "@/components/admin/MetricBlock";

describe("MetricBlock", () => {
  it("renders children and the source label when ok", () => {
    render(
      <MetricBlock title="Traffic" source="umami" status="ok">
        <p>1234 lượt xem</p>
      </MetricBlock>
    );
    expect(screen.getByText("1234 lượt xem")).toBeInTheDocument();
    expect(screen.getByText(/umami/i)).toBeInTheDocument();
  });

  it("renders an explicit error, never a zero, when the source failed", () => {
    render(
      <MetricBlock
        title="Traffic"
        source="umami"
        status="error"
        error="Umami không phản hồi"
      >
        <p>1234 lượt xem</p>
      </MetricBlock>
    );
    expect(screen.getByText("Umami không phản hồi")).toBeInTheDocument();
    expect(screen.queryByText("1234 lượt xem")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- MetricBlock`
Expected: FAIL — module not found.

- [x] **Step 3: Write the component**

Create `apps/frontend/components/admin/MetricBlock.tsx`:

```tsx
"use client";

import { ReactNode } from "react";

type Props = {
  title: string;
  source: "umami" | "postgres" | "cloudflare";
  status: "ok" | "error";
  error?: string | null;
  children: ReactNode;
};

const SOURCE_LABEL: Record<Props["source"], string> = {
  umami: "Umami",
  postgres: "Postgres",
  cloudflare: "Cloudflare",
};

export default function MetricBlock({ title, source, status, error, children }: Props) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-semibold text-text">{title}</h2>
        <span className="text-xs text-muted">Nguồn: {SOURCE_LABEL[source]}</span>
      </header>

      {status === "error" ? (
        <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
          {error ?? "Không lấy được dữ liệu"}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
```

Match the Tailwind token names (`border`, `surface`, `text`, `muted`, `warning`) to whatever the existing admin components use — read `apps/frontend/app/admin/page.tsx` and copy its class vocabulary rather than inventing new tokens.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- MetricBlock`
Expected: both PASS.

- [x] **Step 5: Add the API client method**

In `apps/frontend/lib/api.ts`, inside the `adminApi` object (starts at line 636), following the exact style of the neighbouring `stats:` entry:

```ts
  analyticsOverview: (token: string, days = 30) =>
    clientFetch(`/api/admin/analytics/overview?days=${days}`, token),
```

Read the `stats:` entry first and mirror its helper name and argument order — do not assume `clientFetch` has that signature.

- [x] **Step 6: Build the page**

Create `apps/frontend/app/admin/analytics/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import MetricBlock from "@/components/admin/MetricBlock";
import { Button } from "@/components/ui/button";

type Block<T> = {
  source: "umami" | "postgres" | "cloudflare";
  status: "ok" | "error";
  data: T | null;
  error?: string | null;
};

type Overview = {
  traffic: Block<{ pageviews: number; visitors: number; visits: number; bounce_rate: number }>;
  sources: Block<{ name: string; visitors: number }[]>;
  activity: Block<{ dau: number; wau: number; mau: number; stickiness: number }>;
  funnel: Block<{
    signed_up: number;
    profile_completed: number;
    channel_enabled: number;
    alerted: number;
  }>;
  cohorts: Block<{ cohort_week: string; size: number; d1: number; d7: number; d30: number }[]>;
};

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(await adminApi.analyticsOverview(token));
    } catch (err) {
      // Never fall through to an empty state: "0 visitors" and "the API is
      // down" must not look the same to whoever reads this page.
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <AdminLayout>
        <p className="p-6 text-muted">Đang tải...</p>
      </AdminLayout>
    );
  }

  if (error || !data) {
    return (
      <AdminLayout>
        <div className="m-6 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p className="mb-3 text-sm text-warning">{error ?? "Không có dữ liệu"}</p>
          <Button onClick={load}>Thử lại</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <MetricBlock
          title="Traffic (30 ngày)"
          source={data.traffic.source}
          status={data.traffic.status}
          error={data.traffic.error}
        >
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-muted">Khách duy nhất</dt>
              <dd className="text-2xl font-semibold">{data.traffic.data?.visitors}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Lượt xem trang</dt>
              <dd className="text-2xl font-semibold">{data.traffic.data?.pageviews}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Phiên</dt>
              <dd className="text-2xl font-semibold">{data.traffic.data?.visits}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Bounce</dt>
              <dd className="text-2xl font-semibold">
                {pct(data.traffic.data?.bounce_rate ?? 0)}
              </dd>
            </div>
          </dl>
        </MetricBlock>

        <MetricBlock
          title="Nguồn traffic"
          source={data.sources.source}
          status={data.sources.status}
          error={data.sources.error}
        >
          <ul className="space-y-1 text-sm">
            {data.sources.data?.map((s) => (
              <li key={s.name} className="flex justify-between">
                <span>{s.name}</span>
                <span className="font-medium">{s.visitors}</span>
              </li>
            ))}
          </ul>
        </MetricBlock>

        <MetricBlock
          title="Hoạt động"
          source={data.activity.source}
          status={data.activity.status}
          error={data.activity.error}
        >
          <dl className="grid grid-cols-4 gap-3">
            <div>
              <dt className="text-xs text-muted">DAU</dt>
              <dd className="text-2xl font-semibold">{data.activity.data?.dau}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">WAU</dt>
              <dd className="text-2xl font-semibold">{data.activity.data?.wau}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">MAU</dt>
              <dd className="text-2xl font-semibold">{data.activity.data?.mau}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Stickiness</dt>
              <dd className="text-2xl font-semibold">
                {pct(data.activity.data?.stickiness ?? 0)}
              </dd>
            </div>
          </dl>
        </MetricBlock>

        <MetricBlock
          title="Funnel kích hoạt"
          source={data.funnel.source}
          status={data.funnel.status}
          error={data.funnel.error}
        >
          <ol className="space-y-1 text-sm">
            <li>Đăng ký: {data.funnel.data?.signed_up}</li>
            <li>Hoàn thiện hồ sơ: {data.funnel.data?.profile_completed}</li>
            <li>Bật kênh alert: {data.funnel.data?.channel_enabled}</li>
            <li>Đã nhận alert: {data.funnel.data?.alerted}</li>
          </ol>
        </MetricBlock>

        <MetricBlock
          title="Cohort retention"
          source={data.cohorts.source}
          status={data.cohorts.status}
          error={data.cohorts.error}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th>Tuần</th>
                <th>Size</th>
                <th>D1</th>
                <th>D7</th>
                <th>D30</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.data?.map((c) => (
                <tr key={c.cohort_week}>
                  <td>{c.cohort_week}</td>
                  <td>{c.size}</td>
                  <td>{pct(c.d1)}</td>
                  <td>{pct(c.d7)}</td>
                  <td>{pct(c.d30)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MetricBlock>
      </div>
    </AdminLayout>
  );
}
```

Before running it: confirm `AdminLayout`, `Button`, `useAuth`, and the Tailwind token names (`muted`, `warning`) match what `apps/frontend/app/admin/page.tsx` and `apps/frontend/app/admin/alerts/page.tsx` already import and use. Copy their import lines verbatim rather than trusting the ones above.

- [x] **Step 7: Add the sidebar link**

In `apps/frontend/components/admin/AdminSidebar.tsx`, add an entry pointing at `/admin/analytics`, following the shape of the existing entries.

- [~] **Step 8: Verify in the browser** — BO QUA, can con nguoi

Log in as an admin, open `/admin/analytics`. Then stop Umami (`docker compose stop umami`) and reload.

Expected: the Traffic and Nguồn blocks show "Umami không phản hồi"; the Hoạt động, Funnel and Cohort blocks still render real numbers. Restart Umami afterwards.

> CHUA LAM: stack duy nhat dang chay tren may nay nam sau `tp-nginx` cong 80, ma
> cong 80 la port-forward toi PRODUCTION nen khong duoc dung. Chua co container
> Umami chay cuc bo. Nhanh "Umami chet" da co test tu dong phu ca hai dau:
> `tests/test_analytics_api.py::test_umami_failure_becomes_error_status_not_zero`
> va `components/admin/__tests__/MetricBlock.test.tsx`.

- [x] **Step 9: Commit**

```bash
git add apps/frontend/app/admin/analytics/ apps/frontend/components/admin/MetricBlock.tsx apps/frontend/lib/api.ts apps/frontend/components/admin/AdminSidebar.tsx apps/frontend/__tests__/admin/MetricBlock.test.tsx
git commit -m "feat(analytics): trang /admin/analytics, moi khoi ghi ro nguon va trang thai"
```

---

### Task 5: Alert click-through tracking

**Files:**
- Create: `apps/backend/alembic/versions/020_alert_logs_click.py`
- Modify: `apps/backend/app/models/alert_log.py` (two new fields)
- Create: `apps/backend/app/api/redirect.py`
- Modify: `apps/backend/app/main.py` (register the router)
- Modify: `apps/backend/app/services/job_matcher.py` (`log_and_send` + `_format_job_message`)
- Test: `apps/backend/tests/test_alert_click.py`

**Interfaces:**
- Consumes: `app.alert_logs` (head is `019` after the foundation plan; `job_source` already exists from migration `017`).
- Produces:
  - `AlertLog.clicked_at: Mapped[datetime | None]`, `AlertLog.click_count: Mapped[int]` (default 0)
  - `GET /r/{alert_log_id}` → `302` to the job's real URL, recording the click
  - CTR = `count(clicked_at) / count(*)` per channel

- [x] **Step 1: Write the failing tests**

Create `apps/backend/tests/test_alert_click.py`:

```python
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.alert_log import AlertLog


@pytest.mark.asyncio
async def test_redirect_records_click_and_302s(client, db_session, seed_user):
    log = AlertLog(
        user_id=seed_user.id,
        source_job_id="job-42",
        job_source="vietnamworks",
        channel="telegram",
        sent_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    resp = await client.get(f"/r/{log.id}", follow_redirects=False)

    assert resp.status_code == 302
    assert resp.headers["location"].startswith("http")

    reloaded = (
        await db_session.execute(select(AlertLog).where(AlertLog.id == log.id))
    ).scalar_one()
    assert reloaded.clicked_at is not None
    assert reloaded.click_count == 1


@pytest.mark.asyncio
async def test_second_click_increments_but_keeps_first_timestamp(
    client, db_session, seed_user
):
    log = AlertLog(
        user_id=seed_user.id,
        source_job_id="job-43",
        job_source="vietnamworks",
        channel="email",
        sent_at=datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    db_session.add(log)
    await db_session.commit()
    await db_session.refresh(log)

    await client.get(f"/r/{log.id}", follow_redirects=False)
    first = (
        await db_session.execute(select(AlertLog).where(AlertLog.id == log.id))
    ).scalar_one().clicked_at

    await client.get(f"/r/{log.id}", follow_redirects=False)
    reloaded = (
        await db_session.execute(select(AlertLog).where(AlertLog.id == log.id))
    ).scalar_one()

    assert reloaded.click_count == 2
    assert reloaded.clicked_at == first


@pytest.mark.asyncio
async def test_unknown_id_redirects_home_instead_of_500(client):
    resp = await client.get(f"/r/{uuid.uuid4()}", follow_redirects=False)
    assert resp.status_code == 302
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_alert_click.py -v`
Expected: FAIL — 404 on `/r/{id}` and no `clicked_at` attribute.

- [x] **Step 3: Write the migration**

Create `apps/backend/alembic/versions/020_alert_logs_click.py`:

```python
"""alert_logs: them clicked_at + click_count de do CTR cua alert

Revision ID: 020
Revises: 019
Create Date: 2026-08-02

He thong dang do duoc "da gui bao nhieu alert" nhung khong biet co ai bam vao
khong. CTR la chi so manh nhat cho phan trinh bay: "alert dat X% CTR" thuyet
phuc hon nhieu so voi "da gui 10.000 alert".
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020"
down_revision: Union[str, None] = "019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "alert_logs",
        sa.Column("clicked_at", sa.DateTime(timezone=True), nullable=True),
        schema="app",
    )
    op.add_column(
        "alert_logs",
        sa.Column("click_count", sa.Integer(), server_default="0", nullable=False),
        schema="app",
    )
    op.create_index(
        "ix_alert_logs_clicked_at", "alert_logs", ["clicked_at"], schema="app"
    )


def downgrade() -> None:
    op.drop_index("ix_alert_logs_clicked_at", table_name="alert_logs", schema="app")
    op.drop_column("alert_logs", "click_count", schema="app")
    op.drop_column("alert_logs", "clicked_at", schema="app")
```

- [x] **Step 4: Add the model fields**

In `apps/backend/app/models/alert_log.py`, after the `source` field:

```python
    clicked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    click_count: Mapped[int] = mapped_column(Integer, server_default="0", default=0)
```

- [x] **Step 5: Write the redirect endpoint**

Create `apps/backend/app/api/redirect.py`:

```python
"""Click-tracking redirect for job alerts.

Deliberately unauthenticated: it is opened from a Telegram message or an email
client that carries no session. The id is a random UUID, and the only thing a
guesser gains is inflating a click counter.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

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
        now = datetime.now(timezone.utc)
        log.click_count = (log.click_count or 0) + 1
        if log.clicked_at is None:
            log.clicked_at = now
        await db.commit()
    except Exception:
        # A failed counter must never cost the user their click-through.
        logger.warning("click tracking failed for %s", alert_log_id, exc_info=True)
        await db.rollback()

    return RedirectResponse(target or HOME_URL, status_code=302)
```

- [x] **Step 6: Register the router**

In `apps/backend/app/main.py`:

```python
from app.api import redirect

app.include_router(redirect.router)
```

- [x] **Step 7: Apply the migration and run the tests**

Run: `alembic upgrade head && pytest tests/test_alert_click.py -v`
Expected: all three PASS.

- [x] **Step 8: Point alert messages at the tracking link**

`_build_job_url` in `apps/backend/app/services/job_matcher.py:390-393` returns the raw `source_url`, and it has no access to an `AlertLog` id because the message is formatted before the ids are known.

Reorder `log_and_send` so the ids exist first:

1. Flush the `website` rows (already happens at `job_matcher.py:345`).
2. Build a `{source_job_id: alert_log_id}` map from the flushed rows.
3. Pass that map into `_format_job_message` and use `https://talentpuse.io.vn/r/{id}` in the anchor.
4. Keep `_build_job_url` as the fallback for any job with no mapped id.

`apps/backend/tests/test_job_alert.py::test_format_uses_source_url` asserts the old behaviour and will fail — update it to assert the message now contains `/r/`.

- [~] **Step 9: Verify the whole loop by hand** — BO QUA, can con nguoi

Trigger a dispatch to a test account, click the link in the received Telegram message, then run:

```bash
psql "$DATABASE_URL" -c "SELECT channel, count(*) AS sent, count(clicked_at) AS clicked, round(100.0*count(clicked_at)/count(*),1) AS ctr FROM app.alert_logs WHERE channel IN ('telegram','email') GROUP BY channel;"
```

Expected: the `telegram` row shows `clicked >= 1`. That query is the CTR number for the pitch deck.

> CHUA LAM: buoc nay bat buoc phai gui alert THAT (token Telegram/Resend that) va
> co nguoi that bam link. DB dev dang chua ket noi Telegram cua nguoi dung that
> nen khong duoc chay `dispatch_alerts()` o day. Cau query da chay thu va tra
> dung dinh dang tren DB dev: `telegram | sent=156 | clicked=0 | ctr=0.0`.

- [x] **Step 10: Commit**

```bash
git add apps/backend/alembic/versions/020_alert_logs_click.py apps/backend/app/models/alert_log.py apps/backend/app/api/redirect.py apps/backend/app/main.py apps/backend/app/services/job_matcher.py apps/backend/tests/test_alert_click.py apps/backend/tests/test_job_alert.py
git commit -m "feat(analytics): link /r/{id} do CTR cua alert"
```

---

## Definition of Done

- [x] `pytest tests/ -q`: 511 passed / 13 failed — dung 13 loi da do san tu truoc (moc: 497/13). `alembic upgrade head` -> `020`, `downgrade -1` -> `019` va upgrade lai deu sach.
- [x] `GET /api/admin/analytics/overview` returns 403 for a non-admin and 200 for an admin. (test_analytics_api.py)
- [x] With Umami stopped, the endpoint still returns 200 and the traffic block reads `status: "error"`, `data: null` — never `0`. (test tu dong, chua kiem tay)
- [~] `/admin/analytics` renders all five blocks, each labelled with its source. — code + tsc + jest sach, CHUA mo trinh duyet (xem Task 4 Step 8).
- [~] Clicking a job link in a real Telegram alert increments `click_count` and sets `clicked_at`. — CHUA, can gui alert that (xem Task 5 Step 9).
- [~] The CTR query in Task 5 Step 9 returns a real percentage. — query chay duoc, con cho so click that.

## Spec coverage note — §6.4 "Chiều sâu sử dụng"

Spec §6.4 lists alerts sent per channel, distinct jobs alerted, chat sessions/messages, interview sessions/answers, tracked applications, and jobs in the warehouse. **All of these already ship** on the existing `/admin` overview page (12 KPI cards fed by `GET /api/admin/stats` → `app/services/admin.py:33-127`). No task re-implements them.

The only part of §6.4 that did not exist is alert click-through, which is Task 5 here. The `/admin/analytics` page links to `/admin` for the rest rather than duplicating queries that are already correct.

## Deferred

**Cloudflare block.** `Block.source` already allows `"cloudflare"` and the page renders blocks generically, so adding it later is one client module plus one block — no refactor. It is deferred because the cutover is blocked on spec risk **R1**: the site answers HTTPS with `Server: nginx/1.27.5` while the compose nginx listens on `:80` only, so an undocumented TLS layer exists. Resolve that (`ssh` to the web box, `ss -lntp | grep :443`) before choosing an SSL mode.

Until Cloudflare is live, traffic numbers come only from Umami (client-side, so ad blockers undercount) and the nginx JSON access log (server-side, complete). Say so when presenting them.
