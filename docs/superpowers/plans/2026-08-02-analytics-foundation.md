# Analytics Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data foundation that makes DAU/WAU/MAU + retention measurable (with backfilled history), persist nginx access logs, and stand up self-hosted Umami behind a first-party path.

**Architecture:** Three independent layers. (1) `app.users.last_active_at` written at most once per user per hour via a Redis-throttled hook on the auth dependency; a SQL view `app.user_activity_daily` reconstructs historical activity from existing timestamped tables so retention curves reach back to the first user. (2) nginx logs JSON to a host-mounted volume. (3) Umami runs as one container against a separate database on the existing Postgres instance, with its tracker served first-party through `/s/*` so ad blockers do not silently delete the numbers.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Alembic · Postgres · Redis (`redis>=5.0`, already a dependency) · Next.js 14 App Router · nginx · Docker Compose · pytest + pytest-asyncio

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-02-admin-traffic-analytics-design.md`
- **Alembic head is `017`** (`alembic/versions/017_alert_logs_job_source.py`). The new migration is **`018`** with `down_revision = "017"`.
- **All timestamps are timezone-aware UTC.** Use `datetime.now(timezone.utc)`. `datetime.utcnow()` is banned — it returns a naive value and this repo has already shipped three timezone defects because of it (JA-25, JA-T1, JA-T2 in `docs/superpowers/bugs/2026-08-02-job-alert-audit.md`).
- **All "per day" grouping uses the VN calendar day**: `DATE(<ts> AT TIME ZONE 'Asia/Ho_Chi_Minh')`. Never group by a raw UTC timestamp.
- Existing cache helpers live in `app/core/cache.py` and degrade silently when Redis is down (module-level `_unavailable` flag). Follow that pattern — Redis being down must never break a request.
- Backend engine is `pool_size=5, max_overflow=0` (`app/core/database.py:28-33`). Nothing added here may hold a connection across network I/O.
- Only send a user's UUID to Umami. Never email, name, or any profile field.
- Test fixtures already available in `apps/backend/tests/conftest.py`: `db_session`, `session_factory`, `seed_user`, `client`, `auth_headers`.
- Run all backend commands from `apps/backend/`.

---

### Task 1: `last_active_at` column and model field

**Files:**
- Create: `apps/backend/alembic/versions/018_users_last_active.py`
- Modify: `apps/backend/app/models/user.py:38` (add field after `created_at`)
- Test: `apps/backend/tests/test_user_activity.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `User.last_active_at: Mapped[datetime | None]` — nullable `TIMESTAMP WITH TIME ZONE`, and DB index `ix_users_last_active_at`. Task 2 writes it; Task 3 reads it.

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/test_user_activity.py`:

```python
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.user import User


@pytest.mark.asyncio
async def test_last_active_at_defaults_to_null_and_accepts_aware_datetime(db_session, seed_user):
    result = await db_session.execute(select(User).where(User.id == seed_user.id))
    user = result.scalar_one()
    assert user.last_active_at is None

    stamp = datetime(2026, 8, 2, 3, 30, tzinfo=timezone.utc)
    user.last_active_at = stamp
    await db_session.commit()

    result = await db_session.execute(select(User).where(User.id == seed_user.id))
    reloaded = result.scalar_one()
    assert reloaded.last_active_at is not None
    assert reloaded.last_active_at.tzinfo is not None
    assert reloaded.last_active_at == stamp
```

- [x] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_user_activity.py::test_last_active_at_defaults_to_null_and_accepts_aware_datetime -v`
Expected: FAIL with `AttributeError: type object 'User' has no attribute 'last_active_at'`

- [x] **Step 3: Add the model field**

In `apps/backend/app/models/user.py`, add after the `created_at` line. `DateTime` must be imported from `sqlalchemy` — check the existing import line and add it if missing:

```python
    last_active_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
```

- [x] **Step 4: Write the migration**

Create `apps/backend/alembic/versions/018_users_last_active.py`:

```python
"""users: them cot last_active_at

Revision ID: 018
Revises: 017
Create Date: 2026-08-02

DAU/WAU/MAU khong tinh duoc tu du lieu hien co vi User khong luu lan hoat dong
gan nhat. Cot nay duoc ghi toi da 1 lan/user/gio (throttle bang Redis) nen chi
phi ghi khong dang ke.

timezone=True BAT BUOC: repo da tung dinh loi vi ghi naive datetime vao cot
timestamp (JA-T1) — gia tri bi dien giai theo TimeZone cua session, khong phai UTC.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_active_at", sa.DateTime(timezone=True), nullable=True),
        schema="app",
    )
    op.create_index(
        "ix_users_last_active_at", "users", ["last_active_at"], schema="app"
    )


def downgrade() -> None:
    op.drop_index("ix_users_last_active_at", table_name="users", schema="app")
    op.drop_column("users", "last_active_at", schema="app")
```

- [x] **Step 5: Apply the migration and run the test**

Run: `alembic upgrade head && pytest tests/test_user_activity.py -v`
Expected: migration applies cleanly, test PASSES.

- [x] **Step 6: Verify the migration is reversible**

Run: `alembic downgrade -1 && alembic upgrade head`
Expected: both complete without error. This catches a broken `downgrade()` now instead of during an incident.

- [x] **Step 7: Commit**

```bash
git add apps/backend/alembic/versions/018_users_last_active.py apps/backend/app/models/user.py apps/backend/tests/test_user_activity.py
git commit -m "feat(analytics): them cot users.last_active_at (migration 018)"
```

---

### Task 2: Redis-throttled activity tracking

**Files:**
- Modify: `apps/backend/app/core/cache.py` (append one helper)
- Create: `apps/backend/app/services/activity.py`
- Modify: `apps/backend/app/core/security.py:37-40` (call the tracker from `get_current_user`)
- Test: `apps/backend/tests/test_activity_tracker.py`

**Interfaces:**
- Consumes: `User.last_active_at` (Task 1); `app/core/cache.py` `_get_client()`.
- Produces:
  - `app.core.cache.cache_claim(key: str, ttl_seconds: int) -> bool` — returns `True` exactly once per key per TTL window; returns `True` when Redis is unavailable (fail-open).
  - `app.services.activity.touch_user_activity(db: AsyncSession, user_id: uuid.UUID) -> bool` — returns `True` if it wrote a row, `False` if throttled.

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/test_activity_tracker.py`:

```python
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.models.user import User
from app.services import activity


@pytest.mark.asyncio
async def test_touch_writes_once_then_throttles(db_session, seed_user, monkeypatch):
    claims = {"count": 0}

    async def fake_claim(key: str, ttl_seconds: int) -> bool:
        claims["count"] += 1
        return claims["count"] == 1  # first call wins, later calls throttled

    monkeypatch.setattr(activity, "cache_claim", fake_claim)

    assert await activity.touch_user_activity(db_session, seed_user.id) is True
    assert await activity.touch_user_activity(db_session, seed_user.id) is False

    result = await db_session.execute(select(User).where(User.id == seed_user.id))
    user = result.scalar_one()
    assert user.last_active_at is not None
    assert user.last_active_at.tzinfo is not None


@pytest.mark.asyncio
async def test_touch_is_fail_open_when_redis_unavailable(db_session, seed_user, monkeypatch):
    async def claim_always_true(key: str, ttl_seconds: int) -> bool:
        return True

    monkeypatch.setattr(activity, "cache_claim", claim_always_true)

    assert await activity.touch_user_activity(db_session, seed_user.id) is True


@pytest.mark.asyncio
async def test_touch_never_raises_when_the_update_fails(db_session, seed_user, monkeypatch):
    async def claim_always_true(key: str, ttl_seconds: int) -> bool:
        return True

    async def boom(*args, **kwargs):
        raise RuntimeError("db exploded")

    monkeypatch.setattr(activity, "cache_claim", claim_always_true)
    monkeypatch.setattr(db_session, "execute", boom)

    # Activity tracking is best-effort telemetry: it must never break the request.
    assert await activity.touch_user_activity(db_session, seed_user.id) is False
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_activity_tracker.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.activity'`

- [x] **Step 3: Add the `cache_claim` helper**

Append to `apps/backend/app/core/cache.py`:

```python
async def cache_claim(key: str, ttl_seconds: int) -> bool:
    """Claim a key for `ttl_seconds`. True the first time, False afterwards.

    Used to throttle writes. When Redis is unavailable this returns True
    (fail-open): losing the throttle degrades performance, losing the data
    degrades the product.
    """
    client = _get_client()
    if client is None:
        return True
    try:
        return bool(await client.set(key, "1", nx=True, ex=ttl_seconds))
    except Exception:
        logger.warning("cache_claim failed for key=%s, failing open", key)
        return True
```

- [x] **Step 4: Write the activity service**

Create `apps/backend/app/services/activity.py`:

```python
"""Best-effort last-active tracking.

Writing on every authenticated request would add a round-trip to every call.
Instead a Redis claim allows at most one UPDATE per user per hour, which is
enough resolution for DAU/WAU/MAU.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_claim
from app.models.user import User

logger = logging.getLogger(__name__)

ACTIVITY_TTL_SECONDS = 3600


async def touch_user_activity(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """Record that `user_id` was active. Returns True if a row was written."""
    now = datetime.now(timezone.utc)
    claim_key = f"active:{user_id}:{now.strftime('%Y%m%d%H')}"

    if not await cache_claim(claim_key, ACTIVITY_TTL_SECONDS):
        return False

    try:
        await db.execute(
            update(User).where(User.id == user_id).values(last_active_at=now)
        )
        await db.commit()
        return True
    except Exception:
        logger.warning("touch_user_activity failed for user %s", user_id, exc_info=True)
        await db.rollback()
        return False
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_activity_tracker.py -v`
Expected: all three PASS.

- [x] **Step 6: Call the tracker from the auth dependency**

In `apps/backend/app/core/security.py`, inside `get_current_user`, immediately before the `return user` at the end of the function, add:

```python
    await touch_user_activity(db, user.id)
```

And add the import at the top of the file:

```python
from app.services.activity import touch_user_activity
```

- [x] **Step 7: Verify no existing test broke**

Run: `pytest tests/ -q`
Expected: same pass/fail counts as before this task. `get_current_user` now performs one extra Redis call per request and at most one UPDATE per user-hour.

- [x] **Step 8: Commit**

```bash
git add apps/backend/app/core/cache.py apps/backend/app/services/activity.py apps/backend/app/core/security.py apps/backend/tests/test_activity_tracker.py
git commit -m "feat(analytics): ghi last_active_at, throttle 1 lan/user/gio bang Redis"
```

---

### Task 3: `user_activity_daily` view (backfills history)

**Files:**
- Create: `apps/backend/alembic/versions/019_user_activity_daily_view.py`
- Test: `apps/backend/tests/test_user_activity_view.py`

**Interfaces:**
- Consumes: existing tables `app.chat_messages`, `app.chat_rooms`, `app.interview_sessions`, `app.interview_answers`, `app.interview_messages`, `app.job_applications`, `app.cv_documents`, `app.alert_logs`, `app.users`.
- Produces: view `app.user_activity_daily(user_id uuid, activity_date date, was_active boolean, was_alerted boolean)`. One row per (user, VN calendar day) on which anything happened. The dashboard plan reads it.

**Why this task exists:** `last_active_at` only starts collecting on deploy day. This view reconstructs activity from data already in the database, so retention curves reach back to the first user instead of starting from zero.

**Critical distinction:** `alert_logs` records what the *system sent to* the user, not what the user *did*. Counting it as activity would inflate retention with our own alerts. It goes in a separate `was_alerted` column.

- [x] **Step 1: Write the failing test**

Create `apps/backend/tests/test_user_activity_view.py`:

```python
from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from app.models.alert_log import AlertLog
from app.models.chat import ChatRoom


@pytest.mark.asyncio
async def test_user_action_marks_was_active(db_session, seed_user):
    db_session.add(
        ChatRoom(
            user_id=seed_user.id,
            created_at=datetime(2026, 7, 1, 5, 0, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    rows = (
        await db_session.execute(
            text(
                "SELECT activity_date, was_active, was_alerted "
                "FROM app.user_activity_daily WHERE user_id = :uid"
            ),
            {"uid": str(seed_user.id)},
        )
    ).mappings().all()

    assert len(rows) == 1
    assert rows[0]["was_active"] is True
    assert rows[0]["was_alerted"] is False


@pytest.mark.asyncio
async def test_alert_alone_is_not_counted_as_activity(db_session, seed_user):
    db_session.add(
        AlertLog(
            user_id=seed_user.id,
            source_job_id="job-1",
            channel="website",
            sent_at=datetime(2026, 7, 2, 5, 0, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    row = (
        await db_session.execute(
            text(
                "SELECT was_active, was_alerted FROM app.user_activity_daily "
                "WHERE user_id = :uid"
            ),
            {"uid": str(seed_user.id)},
        )
    ).mappings().one()

    assert row["was_alerted"] is True
    assert row["was_active"] is False


@pytest.mark.asyncio
async def test_day_boundary_uses_vietnam_calendar_day(db_session, seed_user):
    # 2026-07-03 18:30 UTC == 2026-07-04 01:30 in Asia/Ho_Chi_Minh.
    db_session.add(
        ChatRoom(
            user_id=seed_user.id,
            created_at=datetime(2026, 7, 3, 18, 30, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    row = (
        await db_session.execute(
            text(
                "SELECT activity_date FROM app.user_activity_daily WHERE user_id = :uid"
            ),
            {"uid": str(seed_user.id)},
        )
    ).mappings().one()

    assert str(row["activity_date"]) == "2026-07-04"
```

- [x] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_user_activity_view.py -v`
Expected: FAIL with `relation "app.user_activity_daily" does not exist`

- [x] **Step 3: Confirm the column and join names before writing SQL**

Run:

```bash
psql "$DATABASE_URL" -c "\d app.chat_messages" -c "\d app.interview_answers" -c "\d app.interview_messages" -c "\d app.job_applications" -c "\d app.cv_documents"
```

The SQL below assumes the join keys `chat_messages.room_id`, `interview_answers.session_id`, `interview_messages.session_id`, and a `created_at` on each table. If a table names them differently, adjust the SQL — never adjust the tests to match a wrong query.

- [x] **Step 4: Write the migration that creates the view**

Create `apps/backend/alembic/versions/019_user_activity_daily_view.py`:

```python
"""view user_activity_daily: dung lai lich su hoat dong tu cac bang san co

Revision ID: 019
Revises: 018
Create Date: 2026-08-02

last_active_at chi co du lieu tu ngay trien khai. View nay gop timestamp cua
cac bang da co nen duong cong retention lui duoc ve tan user dau tien.

alert_logs KHONG tinh la was_active: do la thu HE THONG GUI CHO user, khong
phai user chu dong dung san pham. Gop chung se thoi phong retention bang chinh
alert cua minh.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

VN = "Asia/Ho_Chi_Minh"

CREATE_VIEW = f"""
CREATE OR REPLACE VIEW app.user_activity_daily AS
WITH events AS (
    SELECT user_id, created_at AS ts, TRUE  AS active FROM app.chat_rooms
    UNION ALL
    SELECT r.user_id, m.created_at,   TRUE
        FROM app.chat_messages m JOIN app.chat_rooms r ON r.id = m.room_id
    UNION ALL
    SELECT user_id, created_at,       TRUE  FROM app.interview_sessions
    UNION ALL
    SELECT s.user_id, a.created_at,   TRUE
        FROM app.interview_answers a JOIN app.interview_sessions s ON s.id = a.session_id
    UNION ALL
    SELECT s.user_id, im.created_at,  TRUE
        FROM app.interview_messages im JOIN app.interview_sessions s ON s.id = im.session_id
    UNION ALL
    SELECT user_id, created_at,       TRUE  FROM app.job_applications
    UNION ALL
    SELECT user_id, created_at,       TRUE  FROM app.cv_documents
    UNION ALL
    SELECT user_id, sent_at,          FALSE FROM app.alert_logs
)
SELECT
    user_id,
    DATE(ts AT TIME ZONE '{VN}')            AS activity_date,
    bool_or(active)                         AS was_active,
    bool_or(NOT active)                     AS was_alerted
FROM events
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(ts AT TIME ZONE '{VN}');
"""


def upgrade() -> None:
    op.execute(CREATE_VIEW)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS app.user_activity_daily")
```

- [x] **Step 5: Apply and run the tests**

Run: `alembic upgrade head && pytest tests/test_user_activity_view.py -v`
Expected: all three PASS. The third test is the important one — it proves day boundaries follow the VN calendar, which is the defect class this repo has shipped three times.

- [x] **Step 6: Sanity-check against real data**

Run:

```bash
psql "$DATABASE_URL" -c "SELECT min(activity_date), max(activity_date), count(DISTINCT user_id) FROM app.user_activity_daily;"
```

Expected: `min(activity_date)` is near the earliest real user activity, not today. That is the whole point of this task — if it returns today's date, the view is not reading historical tables and something is wrong.

- [x] **Step 7: Commit**

```bash
git add apps/backend/alembic/versions/019_user_activity_daily_view.py apps/backend/tests/test_user_activity_view.py
git commit -m "feat(analytics): view user_activity_daily, dung lai retention lich su"
```

---

### Task 4: Persist nginx access logs as JSON

**Files:**
- Modify: `deploy/nginx/nginx.conf` (add `log_format`, point `access_log` at it)
- Modify: `docker-compose.yml` (nginx service: add a volume)
- Create: `deploy/nginx/logrotate.conf`

**Interfaces:**
- Consumes: nothing.
- Produces: `./logs/nginx/access.log` on the host, one JSON object per request, rotated daily and kept 30 days.

**Why this task exists:** the access log currently lives only in the container's writable layer and is destroyed on every redeploy, so there is no durable server-side record of traffic. This is the one traffic source ad blockers cannot touch.

- [x] **Step 1: Add the JSON log format**

In `deploy/nginx/nginx.conf`, inside the `http { }` block and before the `server { }` block:

```nginx
    log_format json_combined escape=json
      '{'
        '"time":"$time_iso8601",'
        '"remote_addr":"$remote_addr",'
        '"cf_connecting_ip":"$http_cf_connecting_ip",'
        '"method":"$request_method",'
        '"uri":"$request_uri",'
        '"status":$status,'
        '"bytes":$body_bytes_sent,'
        '"referer":"$http_referer",'
        '"user_agent":"$http_user_agent",'
        '"request_time":$request_time,'
        '"upstream_status":"$upstream_status"'
      '}';
```

Then change the existing `access_log` directive (currently around line 40) to:

```nginx
    access_log /var/log/nginx/access.log json_combined;
```

`$http_cf_connecting_ip` is empty until Cloudflare is in front; it is included now so the log format does not need to change later.

- [x] **Step 2: Mount the log directory**

In `docker-compose.yml`, in the `nginx` service, add a `volumes:` entry alongside the existing config mount:

```yaml
      - ./logs/nginx:/var/log/nginx
```

- [x] **Step 3: Add logrotate config**

Create `deploy/nginx/logrotate.conf`:

```
/var/log/nginx/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 nginx nginx
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
```

Install it on the host with a cron entry (`/etc/cron.daily/`) pointing at the mounted path, or copy it into the container's `/etc/logrotate.d/`. Note in the deploy runbook which one was chosen — an unrotated JSON access log fills the disk.

- [x] **Step 4: Validate the config before restarting anything**

Run:

```bash
docker compose exec nginx nginx -t
```

Expected: `syntax is ok` / `test is successful`. Do **not** skip this — a bad `log_format` takes the whole site down on reload.

- [x] **Step 5: Reload and verify a real line is written**

Run:

```bash
docker compose exec nginx nginx -s reload
curl -sI https://talentpuse.io.vn/ > /dev/null
tail -n 1 logs/nginx/access.log | python -m json.tool
```

Expected: the last line parses as valid JSON and contains `"uri":"/"`. If `python -m json.tool` errors, the `escape=json` setting is missing or a field is unquoted.

- [x] **Step 6: Commit**

```bash
git add deploy/nginx/nginx.conf deploy/nginx/logrotate.conf docker-compose.yml
git commit -m "feat(analytics): nginx ghi access log JSON ra host, giu 30 ngay"
```

---

### Task 5: Umami container on a separate database

**Files:**
- Modify: `docker-compose.yml` (new `umami` service)
- Modify: `.env.example` (document `UMAMI_APP_SECRET`, `UMAMI_DB_PASSWORD`)
- Create: `deploy/umami/README.md` (one-time provisioning steps)

**Interfaces:**
- Consumes: the running `postgres` service.
- Produces: Umami reachable at `http://umami:3000` on the compose network. Task 6 proxies to it.

> `- [!]` = BI CHAN, chua chay. Cac buoc nay can mot bi mat do con nguoi sinh ra
> (`UMAMI_APP_SECRET`, `UMAMI_DB_PASSWORD`) va mot lan dang nhap giao dien Umami.
> Xem `deploy/umami/README.md` — toan bo lenh da duoc viet san o do.

- [!] **Step 1: Provision the database and role**

Run against the existing Postgres (replace `<strong-random>` with a generated value stored in the deploy `.env`):

```bash
docker compose exec postgres psql -U postgres -c "CREATE ROLE umami_app LOGIN PASSWORD '<strong-random>';"
docker compose exec postgres psql -U postgres -c "CREATE DATABASE umami OWNER umami_app;"
```

`umami_app` owns only the `umami` database and has no rights on the application database. A defect in Umami must not be able to read or write `app.*`.

- [x] **Step 2: Add the service**

In `docker-compose.yml`, after the `redis` service:

```yaml
  umami:
    image: ghcr.io/umami-software/umami:postgresql-latest
    container_name: tp-umami
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://umami_app:${UMAMI_DB_PASSWORD}@postgres:5432/umami
      DATABASE_TYPE: postgresql
      APP_SECRET: ${UMAMI_APP_SECRET}
      DISABLE_TELEMETRY: "1"
    depends_on:
      - postgres
    networks:
      - tp-net
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3000/api/heartbeat || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 5
```

No `ports:` entry — Umami is reachable only through nginx. Match `networks:` to the network name the other services already use; check an existing service rather than assuming `tp-net`.

- [x] **Step 3: Document the secrets**

Add to `.env.example`:

```
# Umami analytics (self-hosted). Generate APP_SECRET with: openssl rand -base64 32
UMAMI_APP_SECRET=
UMAMI_DB_PASSWORD=
```

Never commit real values. This repo has already had a secret-leak finding (JA-04).

- [!] **Step 4: Start it and confirm it is healthy**

Run:

```bash
docker compose up -d umami
docker compose logs -f umami   # wait for migrations to finish, then Ctrl-C
docker compose exec umami wget -qO- http://localhost:3000/api/heartbeat
```

Expected: heartbeat responds. First boot runs Umami's own migrations against the `umami` database and takes 30-60s.

- [!] **Step 5: Confirm isolation actually holds**

Run:

```bash
docker compose exec postgres psql -U umami_app -d talentpulse -c "SELECT count(*) FROM app.users;"
```

Expected: **permission denied** (or the database is not accessible at all). If this returns a number, the role has too many rights — fix before continuing.

- [!] **Step 6: Create the tracked website and record its ID**

In the Umami UI (reachable once Task 6 is done, or temporarily via `docker compose port`), log in with the default `admin` account, change the password immediately, and add a website with domain `talentpuse.io.vn`. Copy the generated website ID into the deploy `.env` as `NEXT_PUBLIC_UMAMI_WEBSITE_ID` — Task 7 needs it.

- [x] **Step 7: Write the provisioning notes**

Create `deploy/umami/README.md` documenting: the two SQL commands from Step 1, where `UMAMI_APP_SECRET` / `UMAMI_DB_PASSWORD` live, the website ID, and that the default admin password must be changed on first login. The next person to touch this should not have to reverse-engineer it.

- [x] **Step 8: Commit**

```bash
git add docker-compose.yml .env.example deploy/umami/README.md
git commit -m "feat(analytics): them container Umami tren database rieng"
```

---

### Task 6: Serve the tracker first-party through `/s/*`

**Files:**
- Modify: `deploy/nginx/nginx.conf` (two new `location` blocks)

**Interfaces:**
- Consumes: `umami:3000` (Task 5).
- Produces: `https://talentpuse.io.vn/s/script.js` and `https://talentpuse.io.vn/s/api/send`. Task 7 points the browser at these.

**Why the odd path:** ad-block filter lists match on path substrings, not just hostnames. A path containing `umami`, `analytics`, or `track` is filtered by default rules; `/s/` is not. Serving from the site's own origin is the difference between usable numbers and numbers that are 30-40% short.

- [x] **Step 1: Add the location blocks**

In `deploy/nginx/nginx.conf`, inside the `server { }` block and **above** the catch-all `location / { }` (nginx prefix matching means order matters here):

```nginx
    location = /s/script.js {
        proxy_pass http://umami:3000/script.js;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_intercept_errors on;
        error_page 500 502 503 504 = @analytics_down;
    }

    location = /s/api/send {
        proxy_pass http://umami:3000/api/send;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_intercept_errors on;
        error_page 500 502 503 504 = @analytics_down;
    }

    location @analytics_down {
        return 204;
    }
```

The `@analytics_down` fallback is deliberate: if Umami is down, visitors get an empty `204` instead of a `502`. Analytics failing must never surface as an error on the site.

- [x] **Step 2: Validate the config**

Run: `docker compose exec nginx nginx -t`
Expected: `syntax is ok` / `test is successful`

- [!] **Step 3: Reload and verify both endpoints**

Run:

```bash
docker compose exec nginx nginx -s reload
curl -s -o /dev/null -w "script.js -> %{http_code}\n" https://talentpuse.io.vn/s/script.js
curl -s -X POST -H "Content-Type: application/json" -d '{}' \
     -o /dev/null -w "api/send -> %{http_code}\n" https://talentpuse.io.vn/s/api/send
```

Expected: `script.js -> 200`, and `api/send` returns 200/400/204 (any of these proves it reached Umami and not the Next.js catch-all). A `404` means the location block is below `location /` and never matches.

- [x] **Step 4: Verify the fallback works**

Run:

```bash
docker compose stop umami
curl -s -o /dev/null -w "%{http_code}\n" https://talentpuse.io.vn/s/script.js
docker compose start umami
```

Expected: `204`, not `502`. This is the guarantee that a dead analytics container cannot degrade the site.

- [x] **Step 5: Commit**

```bash
git add deploy/nginx/nginx.conf
git commit -m "feat(analytics): phuc vu tracker Umami first-party qua /s/*"
```

---

### Task 7: Frontend tracker + pseudonymous identify

**Files:**
- Modify: `apps/frontend/app/layout.tsx` (add the script tag)
- Create: `apps/frontend/components/analytics/UmamiIdentify.tsx`
- Modify: the component that consumes `AuthContext` and wraps authenticated pages (read `apps/frontend/context/AuthContext.tsx` first)
- Modify: `apps/frontend/.env.example`
- Test: `apps/frontend/__tests__/analytics/UmamiIdentify.test.tsx`

**Interfaces:**
- Consumes: `/s/script.js` (Task 6); `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (Task 5 Step 6).
- Produces: pageviews in Umami for every route, and a pseudonymous `user_id` attached to sessions of logged-in users.

- [x] **Step 1: Write the failing test**

Create `apps/frontend/__tests__/analytics/UmamiIdentify.test.tsx`. Match the runner the repo already uses — check `package.json` for `vitest` or `jest` and swap `jest.fn()` for `vi.fn()` if it is vitest:

```tsx
import { render } from "@testing-library/react";
import UmamiIdentify from "@/components/analytics/UmamiIdentify";

describe("UmamiIdentify", () => {
  beforeEach(() => {
    (window as any).umami = { identify: jest.fn() };
  });

  it("sends only the user id, never profile data", () => {
    render(<UmamiIdentify userId="4f8c0d2e-1111-2222-3333-444455556666" />);
    expect((window as any).umami.identify).toHaveBeenCalledWith({
      userId: "4f8c0d2e-1111-2222-3333-444455556666",
    });
  });

  it("does nothing for anonymous visitors", () => {
    render(<UmamiIdentify userId={null} />);
    expect((window as any).umami.identify).not.toHaveBeenCalled();
  });

  it("does not throw when the tracker failed to load", () => {
    delete (window as any).umami;
    expect(() =>
      render(<UmamiIdentify userId="4f8c0d2e-1111-2222-3333-444455556666" />)
    ).not.toThrow();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- UmamiIdentify` (from `apps/frontend`)
Expected: FAIL — module not found.

- [x] **Step 3: Write the component**

Create `apps/frontend/components/analytics/UmamiIdentify.tsx`:

```tsx
"use client";

import { useEffect } from "react";

type Props = {
  /** UUID only. Never pass email, name, or any profile field. */
  userId: string | null;
};

export default function UmamiIdentify({ userId }: Props) {
  useEffect(() => {
    if (!userId) return;
    const umami = (window as unknown as { umami?: { identify?: (data: unknown) => void } })
      .umami;
    umami?.identify?.({ userId });
  }, [userId]);

  return null;
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test -- UmamiIdentify`
Expected: all three PASS.

- [x] **Step 5: Add the tracker script to the root layout**

In `apps/frontend/app/layout.tsx`, inside `<head>` (or via `next/script` with `strategy="afterInteractive"`, matching however the file already loads scripts):

```tsx
<script
  defer
  src="/s/script.js"
  data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
  data-host-url="/s"
/>
```

`data-host-url="/s"` is required — without it the script posts to `/api/send`, which nginx routes to FastAPI, and every event is lost.

- [x] **Step 6: Mount the identify component where auth state is known**

Render `<UmamiIdentify userId={user?.id ?? null} />` inside the component that already consumes `AuthContext` and wraps authenticated pages. Read `apps/frontend/context/AuthContext.tsx` to find the exported hook name and the shape of the user object before wiring it — do not assume `useAuth()` returns `{ user }`.

- [x] **Step 7: Document the env var**

Add to `apps/frontend/.env.example`:

```
# Umami website ID (from the Umami UI). Public by design — it only identifies the site.
NEXT_PUBLIC_UMAMI_WEBSITE_ID=
```

- [!] **Step 8: Verify end-to-end in a browser**

Load the site, open DevTools → Network, filter on `send`. Navigating between routes must produce `POST /s/api/send` with a 2xx. Then log in and confirm the Umami UI shows the session with a user ID attached.

Expected: pageviews appear in Umami within ~30 seconds. If `script.js` 404s, Task 6 Step 3 was not verified. If it loads but nothing sends, `data-host-url` is wrong.

- [!] **Step 9: Confirm no PII is leaving the browser**

In DevTools, inspect the request payload of `POST /s/api/send`. It must contain a UUID and page metadata only — no email, no name. If any profile field appears, stop and fix before deploying: this is the boundary the whole privacy decision rests on.

- [x] **Step 10: Commit**

```bash
git add apps/frontend/app/layout.tsx apps/frontend/components/analytics/UmamiIdentify.tsx apps/frontend/.env.example apps/frontend/__tests__/analytics/UmamiIdentify.test.tsx
git commit -m "feat(analytics): nhung tracker Umami + identify chi gui user id"
```

---

## Definition of Done

- [ ] `alembic upgrade head` reaches revision `019`; `alembic downgrade -1` then `upgrade head` both succeed.
- [ ] `pytest tests/ -q` passes with no new failures.
- [ ] `SELECT min(activity_date) FROM app.user_activity_daily` returns a **historical** date, not today.
- [ ] `logs/nginx/access.log` contains valid JSON lines on the host and survives `docker compose up -d nginx`.
- [ ] `curl https://talentpuse.io.vn/s/script.js` returns 200; with `umami` stopped it returns 204, never 502.
- [ ] Umami shows pageviews for real navigation, and a logged-in session carries a user ID.
- [ ] The `POST /s/api/send` payload contains no email, name, or profile field.
- [ ] `umami_app` cannot read `app.users`.

## Follows this plan

`docs/superpowers/plans/2026-08-02-analytics-dashboard.md` — the `/admin/analytics` page, the metric queries, and alert CTR tracking. It depends on Tasks 1-3 and 5-7 here.

The Cloudflare cutover (spec §5.7, step 4) is **not planned yet**: it is blocked on spec risk **R1** — the site answers HTTPS with `Server: nginx/1.27.5` while the compose nginx listens on `:80` only, so an undocumented TLS layer exists. Identify it (`ssh` to the web box, `ss -lntp | grep :443`) before choosing between SSL mode `Full (strict)` and `Flexible`; picking wrong causes either a redirect loop or plaintext HTTP between Cloudflare and the origin.
