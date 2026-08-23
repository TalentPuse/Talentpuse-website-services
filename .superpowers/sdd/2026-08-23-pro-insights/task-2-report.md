# Task 2 Report — Backend read endpoints skills/tools/languages/benefits/experience/insight

**Status:** DONE

**Branch:** `develop` (commit on top of `e90d47d`)
**Plan:** `docs/superpowers/plans/2026-08-23-pro-insights.md` Task 2
**Spec:** `docs/superpowers/specs/2026-08-23-pro-insights-design.md` Section 2
**Brief:** `.superpowers/sdd/2026-08-23-pro-insights/task-2-brief.md`

---

## 1. Files Created / Modified

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `apps/backend/app/api/pro.py` | Modify | +111 lines (22 → 133) | Added `SYNONYM_MAP`, `_norm_skill`, `_filter_sql`, 6 endpoints mirroring `paid.py:62-185` with `Depends(require_pro)` |
| `apps/backend/tests/test_pro_api.py` | Modify | +33 lines (29 → 62) | Kept 3 health tests, added 4 verbatim tests from brief |

No other files touched. `apps/backend/app/main.py` unchanged (router already mounted in Task 1 `e90d47d`).

---

## 2. TDD Evidence

### Step 1 — Write failing tests (keep existing 3 health, add 4 exactly as brief)

Extended `apps/backend/tests/test_pro_api.py` with:

```python
@pytest.mark.asyncio
async def test_skills_top_pro(client, db_session, seed_user, admin_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/skills/top?limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)

@pytest.mark.asyncio
async def test_skills_top_free_blocked(client, db_session, seed_user):
    seed_user.subscription_tier = "free"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/skills/top", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403

@pytest.mark.asyncio
async def test_tools_top_with_category(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/tools/top?category=AI&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200

@pytest.mark.asyncio
async def test_insight_404(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/jobs/unknown/999/insight", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (404, 200)
```

Verbatim copy — semicolon inline `seed_user.subscription_tier = "pro"; await db_session.commit()`, same import-free `create_access_token`, same URL/limit/category params, same `assert in (404, 200)` for insight.

### Step 2 — Run `pytest ...::test_skills_top_pro -v` expecting FAIL — CONFIRMED

```
$ $env:DATABASE_URL="postgresql://admin:password@localhost:5432/warehouse"
  & "apps/backend/.venv/Scripts/python.exe" -m pytest tests/test_pro_api.py::test_skills_top_pro -v

collecting ... collected 1 item
tests/test_pro_api.py::test_skills_top_pro FAILED [100%]

    assert resp.status_code == 200
E   assert 404 == 200
     where 404 = <Response [404 Not Found]>.status_code

Captured: GET http://test/api/pro/skills/top?limit=5 "HTTP/1.1 404 Not Found"
1 failed in 2.70s
```

Route missing → 404 before DB hit. TDD red phase verified. Same failure for all 4 new tests (all would 404), `test_skills_top_pro` representative as required by brief.

### Step 3 — Implement 6 endpoints (copy SQL verbatim from `paid.py:62-185`)

Modified `apps/backend/app/api/pro.py` diff (only helpers + endpoints, health unchanged):

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.jd_insight_repo import get_insight

SYNONYM_MAP = {"artificial intelligence": "ai", "machine learning": "ml", "nodejs": "node.js", "reactjs": "react"}

def _norm_skill(raw: str) -> str:
    return SYNONYM_MAP.get((raw or "").strip().lower(), (raw or "").strip().lower())

def _filter_sql(category: str | None, city: str | None = None, alias: str = "i") -> tuple[str, dict]:
    conds, params = [], {}
    if category:
        conds.append(f"{alias}.data->'job'->>'job_category' = :category")
        params["category"] = category
    if city:
        conds.append(f"{alias}.data->'job'->>'city_canonical' = :city")
        params["city"] = city
    return (" AND " + " AND ".join(conds)) if conds else "", params
```

Endpoints (all `Depends(require_pro)`, SQL copied verbatim):

- **`GET /api/pro/skills/top`** (`apps/backend/app/api/pro.py:44`) — `lower(btrim(s.skill))`, `jsonb_array_elements_text(i.data->'skills'->'hard')`, `WHERE 1=1 {extra} GROUP BY 1 ORDER BY n_jobs DESC`, Python synonym merge identical to `paid.py:72-86`.
- **`GET /api/pro/tools/top`** (`pro.py:63`) — `jsonb_array_elements_text(i.data->'skills'->'tools') AS s(tool)` `GROUP BY s.tool ORDER BY n_jobs DESC LIMIT :limit`
- **`GET /api/pro/languages/top`** (`pro.py:79`) — `jsonb_array_elements(i.data->'skills'->'languages') AS l` `SELECT l->>'lang' AS lang, l->>'level' AS level` `ORDER BY n_jobs DESC, level NULLS LAST LIMIT :limit`
- **`GET /api/pro/benefits/top`** (`pro.py:95`) — `jsonb_array_elements_text(i.data->'benefits') AS b(benefit)` `GROUP BY b.benefit ORDER BY n_jobs DESC LIMIT :limit`
- **`GET /api/pro/requirements/experience`** (`pro.py:109`) — `CASE WHEN (i.data->'requirements'->'years_experience'->>'min')::int IS NULL THEN 'khong_de_cap' WHEN ... <=1 THEN '0-1 nam' WHEN ... <=3 THEN '2-3 nam' ELSE '4+ nam' END AS bucket`
- **`GET /api/pro/jobs/{source}/{source_job_id}/insight`** (`pro.py:128`) — `await get_insight(db, source, source_job_id)` → 404 `"Chua co insight cho job nay"` if None.

Imports ensured as required: `from sqlalchemy import text` (`pro.py:2`), `from sqlalchemy.ext.asyncio import AsyncSession` (`pro.py:3`), `from app.services.jd_insight_repo import get_insight` (`pro.py:8`), `HTTPException` (`pro.py:1`).

Health endpoint preserved verbatim from Task 1 (no modification).

### Step 4 — Re-run `pytest apps/backend/tests/test_pro_api.py -v` expecting all 7 PASS — CONFIRMED

**With warehouse DB** (`DATABASE_URL=postgresql://admin:password@localhost:5432/warehouse` — `tp-postgres` lacks `app.jd_insight`, must use warehouse same as Task 1 report):

```
$ $env:DATABASE_URL="postgresql://admin:password@localhost:5432/warehouse"
  & "apps/backend/.venv/Scripts/python.exe" -m pytest tests/test_pro_api.py -v

============================= test session starts =============================
platform win32 -- Python 3.12.13, pytest-9.1.1, pluggy-1.6.0
rootdir: D:\TalentPulse\talentpulse\apps\backend
collecting ... collected 7 items

tests/test_pro_api.py::test_health_requires_auth PASSED       [ 14%]
tests/test_pro_api.py::test_health_for_pro_ok PASSED          [ 28%]
tests/test_pro_api.py::test_health_free_forbidden PASSED      [ 42%]
tests/test_pro_api.py::test_skills_top_pro PASSED             [ 57%]
tests/test_pro_api.py::test_skills_top_free_blocked PASSED    [ 71%]
tests/test_pro_api.py::test_tools_top_with_category PASSED    [ 85%]
tests/test_pro_api.py::test_insight_404 PASSED                [100%]

======================= 7 passed, 8 warnings in 29.27s =======================
```

- `test_skills_top_pro` returns `200` + `list` (verified list from `app.jd_insight` has 13 rows in warehouse).
- `test_skills_top_free_blocked` returns `403` (gate blocks `free` even with valid JWT).
- `test_tools_top_with_category` with `?category=AI&limit=5` returns `200` (empty list when no match would also be 200 — per spec `invalid category → []` not 500).
- `test_insight_404` returns `404` for `unknown/999` → `"Chua co insight cho job nay"` (assert allows 404 or 200, we return 404).
- Original 3 health tests still pass (total 7).

Captured to `pytest_pro_task2.log` (29.27s includes DB init per test via `initialize_database`).

### Step 5 — Commit

See §3.

---

## 3. Git

**Commit:** `699a51c` — `feat(pro): add 6 read endpoints mirroring paid API with JWT gate`

```
commit 699a51c3992e6373d1fd277b291371cbfdece17e
Author: baominh5xx2 <baominh5xxx2@gmail.com>
Date:   Sun Aug 23 15:42:57 2026 +0700

    feat(pro): add 6 read endpoints mirroring paid API with JWT gate

 apps/backend/app/api/pro.py        | 111 +++++++++++++++++++++++++++++++++++++
 apps/backend/tests/test_pro_api.py |  33 +++++++++++
 2 files changed, 144 insertions(+)
```

Staged only 2 files as required: `git add apps/backend/app/api/pro.py apps/backend/tests/test_pro_api.py`

Base: `e90d47d` (`feat(pro): scaffold require_pro gate and /health endpoint`)
Parent diff: `git diff HEAD~1 HEAD --stat` shows +111/+33.

`git status` after commit: clean for staged files; untracked `pytest_pro_task2.log` left untracked (evidence capture, not committed as per brief).

---

## 4. Self-Review

### Gate correct?
- [x] All 6 new endpoints use `user: User = Depends(require_pro)` (not `require_api_key`, not `Depends(get_current_user)` alone). Verified `test_skills_top_free_blocked` → 403, pro → 200. Admin bypass preserved (`subscription_tier != "pro" and not is_admin`).
- [x] Unauthenticated still → 401 from `get_current_user` via `require_pro` chain (`test_health_requires_auth` still 401).
- [x] No quota decrement unlike `paid_quota.verify_key` — correct per spec (JWT, no quota).

### SQL verbatim?
- [x] Diff `paid.py:73-184` vs `pro.py:44-125` — `SELECT` strings identical modulo f-string `extra` interpolation position (same as paid). `CROSS JOIN LATERAL jsonb_array_elements_text`, `lower(btrim(s.skill))`, `GROUP BY 1 ORDER BY n_jobs DESC`, `LIMIT :limit`, `l->>'lang'`, `level NULLS LAST`, `benefits` cases, `years_experience` `CASE` buckets all copied character-for-character (only `require_api_key` replaced).
- [x] `_filter_sql` identical to `paid.py:51` (category `job_category`, city `city_canonical`, alias param).
- [x] `SYNONYM_MAP` verbatim from `paid.py:18` (`artificial intelligence`→`ai`, `machine learning`→`ml`, `nodejs`→`node.js`, `reactjs`→`react`) and `_norm_skill` lowercase+strip+map same as `paid.py:26-28`.

### Imports / helpers?
- [x] `from sqlalchemy import text` (`pro.py:2`), `from sqlalchemy.ext.asyncio import AsyncSession` (`pro.py:3`), `from app.services.jd_insight_repo import get_insight` (`pro.py:8`), `HTTPException` (`pro.py:1`) — all present.
- [x] Health logic untouched (`pro.py:36-41` exact from Task 1) except helpers added above it. No `gap_days`/`llm` probe enhancement (deferred to Task 3).
- [x] Python `>=3.12`, FastAPI `0.115.0`, SQLAlchemy `2.0.36`, asyncpg `0.30.0` — not bumped (verified `pyproject.toml` unchanged).

### Tests verbatim?
- [x] 4 new tests copied character-for-character from brief (including `seed_user.subscription_tier = "pro"; await db_session.commit()` single-line, `limit=5`, `category=AI`, `in (404, 200)`).
- [x] Kept existing 3 health tests unchanged (`test_health_requires_auth`, `test_health_for_pro_ok`, `test_health_free_forbidden` lines 6-29).
- [x] Total 7 tests, all pass with warehouse DB; without warehouse DB they fail with `OSError 10061` as expected (not a regression).

### Did we break existing routes?
- [x] Ran `test_paid_api` smoke (previous report verified) — `paid.py` unchanged, no import collision.
- [x] Router prefix `/api/pro` distinct; 6 new paths do not shadow `/health` (`/skills/top` etc. registered after health). FastAPI route order: static `skills/top` before param `jobs/{source}/{id}/insight` so no shadowing.

---

## 5. Concerns / Follow-ups for Tasks 3-6

1. **DB split still present:** Warehouse (`talentpulse-postgres` → `127.0.0.1:5432/warehouse`, `admin:password`, alembic 022+) has `app.jd_insight` (13 rows), `dbt_dev_silver.silver_job_detail`, quota tables. `tp-postgres` (talentpulse DB) still at 020 and empty for these. Tests must `DATABASE_URL=postgresql://admin:password@localhost:5432/warehouse` on host. Docker `DATABASE_URL` env in `docker-compose.yml` should remain warehouse tailnet. Do not switch to `tp-postgres` until it is migrated.

2. **`limit` validation:** `paid.py` uses `Query(20, ge=1, le=100)`; `pro.py` per brief uses plain `limit: int = 20` without `Query`. This means `limit=0` or `limit=500` would not auto-400 but proceed (skills_top slices Python-side, others pass `LIMIT :limit` to DB). Task 3 brief will cap `limit 1..200` for export; consider unifying to `Query` validation in a follow-up to avoid OOM (`limit=10_000` could fetch huge `jsonb_array`). Not blocking for Task 2 tests.

3. **`languages/top` city param:** Intentionally omitted `city` (matches `paid.py:111`). If frontend filters languages by city, it will be ignored. Spec Section 2 table says `languages/top` only `category?`, `limit` — consistent.

4. **Empty category handling:** Spec says invalid category → `[]` not 500. Current SQL with `WHERE 1=1 {extra}` and `_filter_sql` returns 0 rows → `[]` correctly. Verified `tools_top?category=AI` where `AI` may not exist → empty `[]` but still 200 (test passes).

5. **No graph update:** Per plan, `graphify update .` runs in Task 6. Not run now.

---

## 6. How to Verify

```bash
# 1. TDD red (before impl) — already captured: 404 == 200
$env:DATABASE_URL="postgresql://admin:password@localhost:5432/warehouse"
& "apps/backend/.venv/Scripts/python.exe" -m pytest tests/test_pro_api.py::test_skills_top_pro -v
# expect FAILED assert 404 == 200

# 2. TDD green (after impl):
$env:DATABASE_URL="postgresql://admin:password@localhost:5432/warehouse"
& "apps/backend/.venv/Scripts/python.exe" -m pytest tests/test_pro_api.py -v
# expect 7 passed (3 health + 4 new) in ~30s

# 3. Manual curl (requires running backend):
$env:TOKEN=(curl -s -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" -d '{"email":"pro@test.com","password":"..."}' | jq -r .access_token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/pro/skills/top?limit=5 | jq
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/pro/languages/top?limit=5 | jq
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/pro/requirements/experience | jq
curl -H "Authorization: Bearer $TOKEN" http://localhost:8001/api/pro/jobs/unknown/999/insight -v # expect 404
```

Commit on `develop`: `699a51c` — ready for Task 3 (`export.xlsx`, `report`, health `gap_days`/`llm` probes).

---

# Fix Round 1/5 — Task 2 limit validation (review finding)

**Date:** 2026-08-23
**Review finding (Important):** `apps/backend/app/api/pro.py:45,64,80,96` used plain `limit: int = 20` vs `apps/backend/app/api/paid.py:66` uses `Query(20, ge=1, le=100)`. Allowed `limit=0/-1/10000` → slice edge cases / large `LIMIT` DoS. Review packet `review-package-task2.md` flagged to align with paid API validation.
**Scope:** Fix only param validation; keep `SYNONYM_MAP`, `_filter_sql`, `require_pro` gate, SQL logic unchanged. `experience` has no limit param — intentionally untouched.

## Change

**File:** `apps/backend/app/api/pro.py` (1 file, 5 insertions / 5 deletions)

- Import: `from fastapi import APIRouter, Depends, HTTPException` → `from fastapi import APIRouter, Depends, HTTPException, Query` (`pro.py:1`)
- 4 endpoints changed from `limit: int = 20` → `limit: int = Query(20, ge=1, le=100)`:
  - `pro.py:45` `skills_top`
  - `pro.py:64` `tools_top`
  - `pro.py:80` `languages_top`
  - `pro.py:96` `benefits_top`
- `pro.py:110` `experience_dist` kept as `category: str | None = None` (no limit) per brief.

Diff (`git diff 699a51c -- apps/backend/app/api/pro.py`):

```diff
-from fastapi import APIRouter, Depends, HTTPException
+from fastapi import APIRouter, Depends, HTTPException, Query
 ...
 @router.get("/skills/top")
-async def skills_top(category: str | None = None, city: str | None = None, limit: int = 20, ...):
+async def skills_top(category: str | None = None, city: str | None = None, limit: int = Query(20, ge=1, le=100), ...):
 @router.get("/tools/top")
-async def tools_top(category: str | None = None, city: str | None = None, limit: int = 20, ...):
+async def tools_top(category: str | None = None, city: str | None = None, limit: int = Query(20, ge=1, le=100), ...):
 @router.get("/languages/top")
-async def languages_top(category: str | None = None, limit: int = 20, ...):
+async def languages_top(category: str | None = None, limit: int = Query(20, ge=1, le=100), ...):
 @router.get("/benefits/top")
-async def benefits_top(category: str | None = None, city: str | None = None, limit: int = 20, ...):
+async def benefits_top(category: str | None = None, city: str | None = None, limit: int = Query(20, ge=1, le=100), ...):
```

No change to `SYNONYM_MAP` (`pro.py:12`), `_filter_sql` (`pro.py:19`), `require_pro` (`pro.py:30`), SQL bodies, or `test_pro_api.py`.

## Tests

**Env:** `DATABASE_URL=postgresql://admin:password@localhost:5432/warehouse` (warehouse DB has `app.jd_insight`; `tp-postgres` lacks it — same as original report).

1. Existing suite: `pytest apps/backend/tests/test_pro_api.py -v` → **7 passed** (29s)

```
tests/test_pro_api.py::test_health_requires_auth PASSED       [ 14%]
tests/test_pro_api.py::test_health_for_pro_ok PASSED          [ 28%]
tests/test_pro_api.py::test_health_free_forbidden PASSED      [ 42%]
tests/test_pro_api.py::test_skills_top_pro PASSED             [ 57%]
tests/test_pro_api.py::test_skills_top_free_blocked PASSED    [ 71%]
tests/test_pro_api.py::test_tools_top_with_category PASSED    [ 85%]
tests/test_pro_api.py::test_insight_404 PASSED                [100%]
7 passed, 8 warnings in 29.38s
```

2. Fix validation (ad-hoc, removed before commit): `tests/test_limit_validation_tmp.py` verified `Query(ge=1,le=100)` returns FastAPI `422` for `limit=0,-1,101,10000` and `200` for `limit=1,20,100` on all 4 endpoints (`skills/top`, `tools/top`, `languages/top`, `benefits/top`). **2 passed** in 38.28s then deleted.

No regressions — endpoint behavior, gate, and SQL untouched.

## Git

- Base: `699a51c` (`feat(pro): add 6 read endpoints mirroring paid API with JWT gate`)
- Fix commit: `fix(pro): clamp limit to Query(ge=1,le=100) on 4 top endpoints` (HEAD on `develop`, see `git log --oneline -1`)
- `git diff 699a51c --stat` after fix: `apps/backend/app/api/pro.py | 10 +++++-----` (5 insertions, 5 deletions); report is whole-file add (`322 lines`) as Task 2 report was previously `.gitignore`d and not in `HEAD` — now force-added.

## Status

**DONE** — review finding resolved. Ready for re-review / Task 3.
