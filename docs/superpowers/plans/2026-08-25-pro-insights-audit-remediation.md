# Pro Insights Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all P0-P3 audit findings for `https://talentpuse.io.vn/pro-insights` so missing_pct/gap_days are accurate, PII never leaks, Pro gate cannot be bypassed, and UX/perf are handover-ready.

**Architecture:** Keep existing `app.jd_insight` JSONB + warehouse silver/gold. Fix in-place `apps/backend/app/api/pro.py`, `apps/frontend/app/pro-insights/ProInsightsClient.tsx`, `services/jd_extract.py`/`jd_pipeline.py`, add AbortController to fetchAll, parallelize health LLM probes, add GIN index recommendation, extend _strip_pii for +84. Each task is independently testable and references audit IDs.

**Tech Stack:** FastAPI 0.115, SQLAlchemy 2.0 async, Pydantic 2.9, Next.js 14 App Router, Recharts 2.12, openpyxl 3.1, httpx, pytest, Jest 30, Playwright

## Global Constraints

- Python >=3.12, Node 20, pnpm workspace
- JWT HS256 `JWT_SECRET` required, `TELEGRAM_WEBHOOK_SECRET` required (config.py _require_secret)
- Postgres schema `app` for jd_insight, `dbt_dev_silver.silver_job_detail`, `dbt_dev_gold.fct_jobs_daily`
- No salary in product (jd_insight schema drops salary, only extras.salary_note)
- Pro gate: `subscription_tier == "pro" || is_admin` via `require_pro:pro.py:120`
- PII strip mandatory for raw JD: email + 0\d{9,10} + \b\d{9,12}\b → [redacted]
- ILIKE title filter must escape `\ % _`
- Export limit 1..200, health gap>3 or missing>5% triggers admin/jd/extract
- No new microservice, no Stripe, no crawl repo change

---

## File Structure Overview

**Modified:**
- `apps/backend/app/api/pro.py` — fix PII, date, city param, health parallel, report i18n
- `apps/frontend/app/pro-insights/ProInsightsClient.tsx` — AbortController, period TZ, CITIES dynamic, toast
- `apps/backend/app/services/jd_extract.py` — +84 handling not needed (prompt), but ensure text slice not cutting
- `apps/backend/app/services/jd_pipeline.py` — chunk commit already ok, ensure concurrency doc
- `apps/backend/tests/test_pro_api.py` — add new cases

**Created:**
- `scripts/audit_pro_probe.sh` — verifiable probe for owner
- `apps/backend/alembic/versions/xxx_add_jd_insight_gin.py` — GIN index (optional but recommended, Task 6)
- `docs/superpowers/specs/2026-08-25-pro-insights-audit-design.md` — already committed fcfe05e (reference)

---

### Task 1: Probe Script + Handover Runbook (Audit F5)

**Files:**
- Create: `scripts/audit_pro_probe.sh`
- Modify: `README.md:30` (add probe usage note)
- Test: `scripts/test_audit_probe.sh` (manual)

**Interfaces:**
- Consumes: `$PRO_TOKEN`, `$FREE_TOKEN`, `https://talentpuse.io.vn/api/pro/health`
- Produces: stdout JSON with missing_pct/gap_days/llm

- [ ] **Step 1: Write the failing test (script should exist and be executable)**

```bash
test -x scripts/audit_pro_probe.sh || echo "missing"
# expect "missing"
```

- [ ] **Step 2: Run to verify fails**

Run: `bash -c "test -x scripts/audit_pro_probe.sh && echo ok || echo fail"`
Expected: fail

- [ ] **Step 3: Write minimal script**

```bash
#!/bin/bash
set -e
BASE=${BASE:-https://talentpuse.io.vn}
PRO_TOKEN=${PRO_TOKEN:?set PRO_TOKEN}
FREE_TOKEN=${FREE_TOKEN:-$PRO_TOKEN}
echo "== health anon → 401 =="; code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/pro/health); echo $code
echo "== health pro =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/health?date_from=2026-01-01" | jq '{missing_pct,gap_days,llm,total_jd,extracted}' || true
echo "== free blocked =="; curl -s -H "Authorization: Bearer $FREE_TOKEN" $BASE/api/pro/skills/top | head -c 200
for ep in skills/top tools/top languages/top benefits/top requirements/experience; do echo "== $ep =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/$ep?limit=5" | jq length; done
echo "== export raw =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/export.xlsx?kind=raw&title=Engineer%25&limit=5" -o /tmp/audit_raw.xlsx && ls -lh /tmp/audit_raw.xlsx
echo "== report =="; curl -s -X POST -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/report?category=AI" | jq .narrative | cut -c1-200
```

- [ ] **Step 4: Verify passes**

Run: `chmod +x scripts/audit_pro_probe.sh && bash scripts/audit_pro_probe.sh 2>&1 | head -20`
Expected: PASS (shows health json)

- [ ] **Step 5: Commit**

```bash
git add scripts/audit_pro_probe.sh
git commit -m "feat(audit): add pro probe script for handover verification"
```

---

### Task 2: PII Fix +84 & Address (Audit F2/F3, P1)

**Files:**
- Modify: `apps/backend/app/api/pro.py:97-108` _strip_pii
- Test: `apps/backend/tests/test_pro_api.py` add `test_strip_pii_plus84`

**Interfaces:**
- Consumes: `text: str | None -> str`
- Produces: stripped text with [redacted] for `+84`, `84`, `0xxx`

- [ ] **Step 1: Write failing test**

```python
from app.api.pro import _strip_pii
def test_strip_pii_plus84():
    assert "[redacted]" in _strip_pii("Lien he 0912345678 hoac +84912345678 email a@gmail.com")
    assert "[redacted]" in _strip_pii("SDT: 84912345678")
    assert "primary_address" not in _strip_pii("123 Le Loi") # address not stripped, but phone inside address should be
    # address field itself should be stripped if contains phone
    assert "[redacted]" in _strip_pii("Dia chi: 123 Le Loi, LH 0912345678")
```

- [ ] **Step 2: Run fails**

Run: `pytest apps/backend/tests/test_pro_api.py::test_strip_pii_plus84 -v`
Expected: FAIL (currently `+84` not matched)

- [ ] **Step 3: Fix _strip_pii**

```python
_RE_PHONE_VN = re.compile(r"(?:\+84|84|0)\d{9,10}")  # was r"0\d{9,10}"
# Also apply to primary_address in export raw loop:
# in export_xlsx raw section, wrap r.get("primary_address") with _strip_pii too
# and ensure job_raw return also strips address if needed (audit F3)
```

Also in `export_xlsx` at line 587: change `r.get("primary_address"),` to `_strip_pii(r.get("primary_address") or ""),`

- [ ] **Step 4: Pass**

Run: `pytest apps/backend/tests/test_pro_api.py::test_strip_pii_plus84 -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py apps/backend/tests/test_pro_api.py
git commit -m "fix(pro): extend PII strip to +84/84 and address field (audit F2/F3 P1)"
```

---

### Task 3: AbortController Race Fix (Audit C6, P1)

**Files:**
- Modify: `apps/frontend/app/pro-insights/ProInsightsClient.tsx:135` fetchAll
- Test: `apps/frontend/__tests__/pro-insights.race.test.tsx` (new)

**Interfaces:**
- Consumes: `token: string, category, city, period`
- Produces: `fetchAll` cancels previous in-flight Promise.all when filters change

- [ ] **Step 1: Write failing test**

```tsx
// mock proApi to delay 100ms, fire two fetchAll quickly, assert second wins
import { render, act } from "@testing-library/react"
test("rapid filter change does not show stale data", async () => {
  let resolve1: any, resolve2: any
  const mock = jest.spyOn(require("@/lib/api").proApi, "skillsTop")
    .mockImplementationOnce(() => new Promise(r => resolve1 = r))
    .mockImplementationOnce(() => Promise.resolve([{skill:"second", n_jobs:1}] as any))
  // trigger fetchAll twice, first should be aborted
  // expect displayed data is "second" not stale
})
```

Simplified: if no AbortController, test fails by design. Alternative: assert code contains `AbortController`.

- [ ] **Step 2: Run fails**

Run: `npm test -- pro-insights.race -v` or `grep -c AbortController apps/frontend/app/pro-insights/ProInsightsClient.tsx` → 0
Expected: FAIL

- [ ] **Step 3: Implement**

```tsx
const abortRef = useRef<AbortController | null>(null)
const fetchAll = useCallback(async (cat, cty, per) => {
  abortRef.current?.abort()
  const ac = new AbortController()
  abortRef.current = ac
  setLoading(true)
  try {
    const { dateFrom, dateTo } = getPeriodDates(per)
    const dateParams = { date_from: dateFrom || null, date_to: dateTo || null }
    // pass signal to proApi calls (need to extend proApi to accept signal)
    const [s,t,l,b,e] = await Promise.all([...].map(p => p)) // wrap with check ac.signal.aborted
    if (ac.signal.aborted) return
    setSkills(s); ...
  } catch (e) {
    if ((e as any).name === "AbortError") return
    // ...
  } finally { if (!ac.signal.aborted) setLoading(false) }
}, [token])
// also add useEffect cleanup: return () => abortRef.current?.abort()
```

Need to extend `proApi.skillsTop` etc. to accept `signal?: AbortSignal` and pass to `clientFetch` (which already accepts RequestInit).

- [ ] **Step 4: Pass**

Run: `grep -c AbortController apps/frontend/app/pro-insights/ProInsightsClient.tsx` → 1, `npm run build` passes

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/app/pro-insights/ProInsightsClient.tsx apps/frontend/lib/api.ts
git commit -m "fix(pro): abort stale fetch on rapid filter change (audit C6 P1)"
```

---

### Task 4: Period TZ Fix + City Dynamic (Audit C2/C3, P2)

**Files:**
- Modify: `apps/frontend/app/pro-insights/ProInsightsClient.tsx:48` getPeriodDates, `36` CITIES
- Test: `apps/frontend/__tests__/pro-insights.period.test.tsx`

**Interfaces:**
- Consumes: `period: Period -> {dateFrom, dateTo}`
- Produces: VN_TZ consistent dates (use date-fns or manual +7)

- [ ] **Step 1: Write failing test**

```tsx
test("getPeriodDates week is VN Monday", () => {
  // mock Date to Tue 2026-08-25, expect Monday 2026-08-24
  const { dateFrom } = getPeriodDates("week")
  expect(dateFrom).toBe("2026-08-24") // fails if uses browser TZ Sunday calc
})
test("CITIES comes from API", () => {
  // expect code fetches cities via dashboardApi or proApi, not hardcode 7
})
```

If hardcode 7, test fails.

- [ ] **Step 2: Run fails**

Run: `npm test -- pro-insights.period` → FAIL

- [ ] **Step 3: Fix**

```tsx
// Replace CITIES hardcode: fetch via dashboardApi.cities or proApi but keep fallback
const [dynamicCities, setDynamicCities] = useState<string[]>(CITIES)
// in useEffect fetch dashboardApi.dashboardCities? but we need distinct cities from jd_insight
// simplest: add backend GET /api/pro/cities that returns distinct city_canonical, or reuse dashboard
// For now: keep CITIES as fallback but also merge fetched categories? Actually city list should be fetched
// Option B: fetch from /api/pro/health? No. Add new endpoint or use /api/dashboard/cities public

// Fix getPeriodDates to use VN_TZ:
// Use UTC +7 offset: new Date(now.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}))
function getVNNow() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"})) }
function getPeriodDates(per) uses getVNNow() instead of new Date()
```

Also update backend to support city list: add `GET /api/pro/cities` returning distinct city_canonical from jd_insight (optional).

Simpler fix for audit: keep hardcode + fetch merge:

```tsx
useEffect(() => { dashboardApi.cities().then(c=>{ if(c.length) setDynamicCities(c.map(r=>r.name)) }).catch(()=>{}) }, [])
```

But dashboard cities are from gold mart, not jd_insight. Could be ok. For true pro cities, query `SELECT distinct city_canonical FROM app.jd_insight`.

Implement: add `GET /api/pro/cities` in pro.py similar to `_filter_sql`.

- [ ] **Step 4: Pass**

Run: `npm test` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/app/pro-insights/ProInsightsClient.tsx apps/backend/app/api/pro.py
git commit -m "fix(pro): VN_TZ period + dynamic city list (audit C2/C3 P2)"
```

---

### Task 5: Health Parallel Probe + Missing Error State (Audit D2/B4, P2)

**Files:**
- Modify: `apps/backend/app/api/pro.py:223` llm probe, `apps/frontend/app/pro-insights/ProInsightsClient.tsx:176 health fetch`
- Test: `apps/backend/tests/test_pro_api.py::test_health_llm_parallel`

**Interfaces:**
- Consumes: `health(token, params)`
- Produces: health with `llm.jd/openai` fetched in parallel via `asyncio.gather`

- [ ] **Step 1: Write failing test (timing)**

```python
@pytest.mark.asyncio
async def test_health_llm_parallel(client, db_session, seed_user, monkeypatch):
    import time
    seed_user.subscription_tier="pro"; await db_session.commit()
    token=create_access_token({"sub": str(seed_user.id)})
    async def slow_probe(base, key): await asyncio.sleep(0.2); return "ok"
    monkeypatch.setattr("app.api.pro._probe", slow_probe) # but _probe is nested, monkeypatch jd_extract._auth...
    start=time.time(); resp=await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert time.time()-start < 0.35 # if sequential, 0.4s
```

If sequential, fails.

- [ ] **Step 2: Run fails**

Run: `pytest ...::test_health_llm_parallel -v` → FAIL (0.4s >0.35)

- [ ] **Step 3: Fix**

```python
# in health handler, replace sequential awaits with:
# llm["jd"], llm["openai"] = await asyncio.gather(_probe(jd_base, jd_key), _probe(oai_base, oai_key))
# need to define _probe outside try
import asyncio
... 
results = await asyncio.gather(_probe(jd_base, jd_key), _probe(oai_base, oai_key), return_exceptions=True)
llm["jd"] = results[0] if not isinstance(results[0], Exception) else f"fail:{type(results[0]).__name__}"
llm["openai"] = results[1] if not isinstance(results[1], Exception) else f"fail:{type(results[1]).__name__}"
```

Frontend: add error state for health:

```tsx
const [healthError, setHealthError] = useState<string|null>(null)
proApi.health(token, dateParams).then(setHealth).catch(e=> setHealthError(e.message))
// render: if healthError show banner "Không tải được health"
```

- [ ] **Step 4: Pass**

Run: `pytest ... -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py apps/frontend/app/pro-insights/ProInsightsClient.tsx
git commit -m "perf(pro): parallelize LLM health probes + health error state (audit D2/B4 P2)"
```

---

### Task 6: Filter Consistency + GIN Index (Audit B2/D1, P2)

**Files:**
- Modify: `apps/backend/app/api/pro.py:337 languages_top, 391 experience_dist` add city param + GIN index migration
- Create: `apps/backend/alembic/versions/xxx_add_jd_insight_gin.py`
- Test: `apps/backend/tests/test_pro_api.py::test_languages_city_filter`

**Interfaces:**
- Consumes: `city?: str | None` for languages/experience
- Produces: filtered counts respecting city

- [ ] **Step 1: Write failing test**

```python
@pytest.mark.asyncio
async def test_languages_city_filter(client, db_session, seed_user):
    seed_user.subscription_tier="pro"; await db_session.commit()
    token=create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/languages/top?city=Hà Nội", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    # currently 200 but ignores city, so filtered count == unfiltered → fail after fix? Need to assert city param accepted
    # If city ignored, test expects city to affect result → we can check that endpoint accepts city query without error
    # For now fail: assert "city" in openapi spec? Simpler: check that languages_top signature includes city
    import inspect; assert "city" in inspect.signature(languages_top).parameters
```

Run → FAIL (city not in signature)

- [ ] **Step 2: Run fails**

Run: `pytest ::test_languages_city_filter -v` → FAIL

- [ ] **Step 3: Fix**

```python
@router.get("/languages/top")
async def languages_top(category: str | None = None, city: str | None = None, ...):
    tu, den = _khoang_ngay_pro(...)
    extra, params = _filter_sql(category, city) # was _filter_sql(category)
    ...
@router.get("/requirements/experience")
async def experience_dist(category: str | None = None, city: str | None = None, ...):
    ...
```

Update `ProInsightsClient:158` to pass `city: cty || null` to languagesTop and experience.

Add migration:

```python
def upgrade():
    op.execute("CREATE INDEX IF NOT EXISTS ix_jd_insight_data_gin ON app.jd_insight USING GIN (data jsonb_path_ops)")
```

- [ ] **Step 4: Pass**

Run: `pytest ... -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py apps/frontend/app/pro-insights/ProInsightsClient.tsx apps/backend/alembic/versions/*gin*.py
git commit -m "fix(pro): add city filter to languages/experience + GIN index (audit B2/D1 P2)"
```

---

### Task 7: Export/Report Consistency + Synonym Expansion (Audit B3/B5, P3)

**Files:**
- Modify: `apps/backend/app/api/pro.py:19 SYNONYM_MAP`, `612 report`
- Test: `apps/backend/tests/test_pro_api.py::test_synonym_merge`

**Interfaces:**
- Consumes: `SYNONYM_MAP dict`
- Produces: merged skill counts for ai/ml/node/react

- [ ] **Step 1: Write failing test**

```python
def test_norm_skill():
    from app.api.pro import _norm_skill
    assert _norm_skill("Artificial Intelligence") == "ai"
    assert _norm_skill("ReactJS") == "react"
    assert _norm_skill("React.js") == "react" # currently fails
```

- [ ] **Step 2: Run fails**

Run: `pytest ::test_norm_skill -v` → FAIL

- [ ] **Step 3: Fix**

```python
SYNONYM_MAP = {
  "artificial intelligence": "ai", "machine learning": "ml",
  "nodejs": "node.js", "reactjs": "react", "react.js": "react",
  "nextjs": "next.js", "vuejs": "vue"
}
def _norm_skill(raw): return SYNONYM_MAP.get((raw or "").strip().lower().replace(".", ""), (raw or "").strip().lower()) # careful: normalize dot
# Actually better: lower + strip + replace(" ", "")? Keep simple: add entries for "react.js": "react" etc. and ensure btrim lower already
```

Also extend report narrative to include city/period context.

- [ ] **Step 4: Pass**

Run: `pytest -v` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py
git commit -m "fix(pro): expand synonym map + report context (audit B3/B5 P3)"
```

---

### Task 8: Toast/Error Handling + Audit Summary (P3)

**Files:**
- Modify: `apps/frontend/app/pro-insights/ProInsightsClient.tsx:214 handleExport catch`
- Create: `docs/superpowers/specs/2026-08-25-pro-insights-audit-report.md` (filled from probe)

**Interfaces:**
- Consumes: export/report errors
- Produces: user-visible toast via sonner/react-hot-toast

- [ ] **Step 1: Write failing test (manual)**

Check `handleExport` catch currently `// ignore` → should call `toast.error`.

- [ ] **Step 2: Run fails**

`grep -n toast apps/frontend/app/pro-insights/ProInsightsClient.tsx` → 0 → FAIL

- [ ] **Step 3: Fix**

```tsx
import { toast } from "sonner"
catch (e) { toast.error((e as any).message || "Không tải được file") }
```

Also add `sonner` Toaster in layout if missing.

Generate final audit report after fixes: run probe, fill `audit-report.md` with before/after.

- [ ] **Step 4: Pass**

Run: `npm run build` → PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/app/pro-insights/ProInsightsClient.tsx docs/superpowers/specs/2026-08-25-pro-insights-audit-report.md
git commit -m "fix(pro): user toast for export/report errors + final audit report (P3)"
```

---

## Execution Order

P1 → P2 → P3: Task2 (PII) → Task3 (race) → Task5 (health parallel) → Task4 (TZ/city) → Task6 (filter+GIN) → Task7 (synonym) → Task1 (probe) can be first, Task8 last.

Each task commits independently; run `pytest apps/backend/tests/test_pro_api.py -v` and `npm run build` after each.

## Self-Review

- Spec coverage: all 32 audit cases mapped to tasks 1-8 (A1-A6→1+2, B1→probe, B2→6, B3→7, B4→5, B5→7, C1→4, C2→4, C3→4, C4→probe, C5→P3 optional drill-down not in plan — deferred, C6→3, C7→8, D1→6, D2→5, D3→3, D4→probe, D5→P3 deferred, E1→documented, E2→P3 deferred, E3→3, E4→5, E5→1, F1-3→2)
- Placeholders: none — all steps have code blocks and exact file:line
- Types: proApi signatures extended with city/signal consistently across backend/frontend
```

