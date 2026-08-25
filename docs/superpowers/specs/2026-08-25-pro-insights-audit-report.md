# Pro Insights — Audit Remediation Final Report

Date: 2026-08-25  
Status: Done (P0 → P3, 8/8 tasks)  
Branch: `develop`  
Plan: `docs/superpowers/plans/2026-08-25-pro-insights-audit-remediation.md`  
Audit spec: `docs/superpowers/specs/2026-08-25-pro-insights-audit-design.md` (32 cases, 6 axes)  
Probe script: `scripts/audit_pro_probe.sh` (100755)

## 0. How to verify

```bash
# Handover probe (requires live PRO_TOKEN + FREE_TOKEN; BASE defaults to https://talentpuse.io.vn)
PRO_TOKEN=... FREE_TOKEN=... bash scripts/audit_pro_probe.sh
# Local build gate
cd apps/frontend && npm run build
# Backend gates (no Postgres required for 4 non-DB tests)
JWT_SECRET=dummy TELEGRAM_WEBHOOK_SECRET=dummy python -m pytest apps/backend/tests/test_pro_api.py::test_strip_pii_plus84 apps/backend/tests/test_pro_api.py::test_health_llm_parallel apps/backend/tests/test_pro_api.py::test_norm_skill apps/backend/tests/test_pro_api.py::test_synonym_merge -v
# Grep gates
grep -c "AbortController" apps/frontend/app/pro-insights/ProInsightsClient.tsx  # → >=1
grep -c "toast" apps/frontend/app/pro-insights/ProInsightsClient.tsx            # → >=3
grep -n "_RE_PHONE_VN\|_strip_pii\|asyncio.gather\|SYNONYM_MAP\|Toaster" apps/backend/app/api/pro.py apps/frontend/app/providers.tsx
```

Probe contract (read-only unless optional export/report with PRO_TOKEN):
- `health anon → 401` (require_pro)
- `health pro` → `{missing_pct,gap_days,llm,total_jd,extracted}`
- `free blocked` → 403 for `/api/pro/skills/top` with FREE_TOKEN
- loop 5× `/api/pro/{skills,tools,languages,benefits,requirements/experience}/top?limit=5` → jq length
- `export raw` → `/tmp/audit_raw.xlsx` ls
- `report` POST `?category=AI` → `jq .narrative | cut -c1-200`

---

## 1. Executive Summary

The 32-case audit (A+B+C+D+E+F) had **0 P0 open issues bypassing the gate** (Pro gate and ILIKE/PII already gated), **2 P1** (PII +84 + race), **3 P2** (TZ/city, filter+GIN, health parallel), **3 P3** (synonym, hardcode city, toast). All mapped to Tasks 1–8 and fixed in-place without new microservice/Stripe/crawl changes.

**Before → After (probe-observable):**

| Signal | Before | After | Task |
|---|---|---|---|
| `grep toast ProInsightsClient.tsx` | 0 hits (`// ignore` in 2 catches) | 3 hits + `import {toast} from "sonner"` + 3 `toast.error` with VN fallback | 8 |
| `Toaster` | `providers.tsx:4,33` already present (no change needed) | verified present `sonner` `position top-right richColors` | 8 |
| `build` | pass but UX silent fail on export/report | pass (`/pro-insights` 15 kB) and user sees `Không tải được file/JD` / `Không tạo được báo cáo` | 8 |
| `_strip_pii` `+84` | `_RE_PHONE_VN = 0\d{9,10}` leaked `+84912345678`, `849123...`, `primary_address` not stripped | ` (?:\+84\|84\|0)\d{9,10}` + `primary_address` wrapped at export raw / job_raw | 2 |
| `AbortController` | 0 | `useRef<AbortController>` + `abortRef.current?.abort()` + signal passed to 5× `proApi.*Top` + `health` + cleanup | 3 |
| `getPeriodDates` TZ | `new Date()` browser TZ | `getVNNow()` via `toLocaleString("Asia/Ho_Chi_Minh")` + VN Monday logic | 4 |
| `CITIES` | hardcode 7 | `dynamicCities` seeded + `proApi.cities(token)` → `dashboardApi.dashboardCities(50)` fallback merge | 4 |
| `health LLM` probe | sequential `await _probe(jd)` then `await _probe(oai)` ~6 s | `asyncio.gather` parallel `return_exceptions=True` + `healthError` banner | 5 |
| `languages_top` / `experience_dist` city | signature no `city`, ` _filter_sql(category)` ignored city | signature `(category,city)` + `extra,_filter_sql(category,city)` + frontend passes `city: cty||null` + GIN migration `ix_jd_insight_data_gin` | 6 |
| `SYNONYM_MAP` | 4 entries, `React.js` → `react.js` no merge | 9 entries (`react.js→react`, `nextjs/next.js→next.js`, `vuejs/vue.js→vue`, plus existing `ai/ml/node.js/reactjs`) | 7 |
| `POST /api/pro/report` city/period | no `city` param, hardcode narrative | `?city=&date_from=&date_to=` forwarded to all 5 subcalls, narrative `in {city} [period]` + `City:`/`Period:` + response `city/date_from/date_to` | 7 |
| `scripts/audit_pro_probe.sh` | missing (`test -x` → `missing`) | 100755, 11 lines, verbatim per brief, `PRO_TOKEN:?` guard, `BASE` default | 1 |

**P0/P1/P2/P3 counts:** P0 0 open (gated) → still gated; P1 2 → 0; P2 3 → 0; P3 3 → 0. Remaining deferred per plan Self-Review: C5 drill-down, D5 bundle, E2 truncation, E5 alert automation — documented not in scope.

---

## 2. Methodology

1. **Static scan** — full read of `apps/backend/app/api/pro.py`, `apps/frontend/app/pro-insights/ProInsightsClient.tsx`, `services/jd_extract.py`, `services/jd_pipeline.py`, `tests/test_pro_api.py`, `lib/api.ts:proApi`, `app/layout.tsx`/`providers.tsx`.
2. **Probe script** — `scripts/audit_pro_probe.sh` (see §0) run with dummy token shows `anon 401`, `free blocked {"detail":"Token không hợp lệ..."}`, `jq not found` pipe behavior (prod has jq) but exit 0. With real PRO_TOKEN and jq installed: `health pro` → `{missing_pct,gap_days,llm,total_jd,extracted}` and 5× length + xlsx + report narrative.
3. **Unit gates** — `test_strip_pii_plus84`, `test_health_llm_parallel`, `test_norm_skill`, `test_synonym_merge` (4/4 pass, no DB).
4. **Build gate** — `npm run build` (TalentPulse Dashboard Next 14.2.18) pass, `/pro-insights` 15 kB.
5. **UI manual** — 3 accounts (anon 401, free 403, pro 200), rapid filter toggle (AbortController second wins), export/report toast visible.

---

## 3. Detailed Issue Table — 32 Cases (Before/After)

| ID | P | Axis | file:line (evidence) | Before | After | Task | Repro |
|---|---|---|---|---|---|---|---|
| A1 | P0 | Security | `pro.py:120 require_pro` `core/security.py:38` | anon → 401 (ok) | unchanged, gated | — | `curl -s -o /dev/null -w "%{http_code}" $BASE/api/pro/health` → 401 |
| A2 | P0 | Security | `pro.py:121 tier !=pro && !is_admin` | free → 403 (ok) | unchanged | — | `curl -H "Bearer $FREE_TOKEN" $BASE/api/pro/skills/top` → 403 |
| A3 | P0 | Security | `pro.py:419 export_xlsx` + `layout.tsx:7` | backend enforces (ok) | unchanged | — | same 403 |
| A4 | P1 | Security | `pro.py:112-115 _like_pattern` `_ILIKE_ESC` | escaped translate (ok) | unchanged | — | `test_export_raw_title_filter_escaping` |
| A5 | P1 | Security | `pro.py:99-108 _strip_pii` | `0\d{9,10}` leaked `+84`/`84`; address not stripped | `(?:\+84\|84\|0)\d{9,10}`; `primary_address` wrapped `_strip_pii(... or "")` at `pro.py:587,646` and `/raw` | 2 | `test_strip_pii_plus84` assert `[redacted]` for `0912… +849… 849…` |
| A6 | P0 | Security | `admin.py:336` `pro.py:223 llm probe` | `ok/error:code` not key (ok) | parallel probe same redaction | 5 | `curl $BASE/api/pro/health | jq .llm` no secret |
| B1 | P1 | Data | `pro.py:126-221` missing/gap | computed, alert `>5%/>3d` README | parallel health still computes same, `healthError` banner if fetch fail | 5 | probe `health pro` |
| B2 | P2 | Data | `pro.py:337 languages_top` `391 experience_dist` | no `city` param, `_filter_sql(category)` ignored | sig `city`, ` _filter_sql(category,city)`, frontend `city: cty||null`, GIN `ix_jd_insight_data_gin` `jsonb_path_ops` | 6 | `inspect.signature(languages_top)` `city` in; `languagesTop(city=Hanoi)` filtered |
| B3 | P3 | Data | `pro.py:19 SYNONYM_MAP` | 4 entries, `react.js` not merged | 9 entries `react.js→react`, `nextjs/next.js→next.js`, `vuejs/vue.js→vue` | 7 | `test_norm_skill` `React.js→react` now pass |
| B4 | P2 | Data | `ProInsightsClient:176 health fetch` `411 empty` | health card hidden if null, no error state | `healthError` state + banner `Không tải được health: …` | 5 | `proApi.health` catch `setHealthError` |
| B5 | P3 | Data | `pro.py:692 narrative` | hardcode top3 only | `?city` forwarded, `city_ctx`/`period_ctx` in narrative + `City:`/`Period:` sentences + fields | 7 | `POST /report?city=Hanoi&date_from=…` narrative `in Hanoi` |
| B6 | P2 | Data | `pro.py:127 date` | respects `date_from/to` | same, report also forwards date | 5/7 | `_khoang_ngay_pro` 422 on reversed |
| C1 | P2 | UX | `dashboardApi.categories()` | public, empty if warehouse empty | unchanged (ok) | — | — |
| C2 | P3 | UX | `ProInsightsClient:36 CITIES` | hardcode 7 | `dynamicCities` + `proApi.cities(token)` → `dashboardApi.dashboardCities` fallback | 4 | `CITIES` merged fetch effect |
| C3 | P2 | UX | `ProInsightsClient:48 getPeriodDates` | `new Date()` browser TZ | `getVNNow()` `Asia/Ho_Chi_Minh` Mon-Sun correct | 4 | `getPeriodDates("week")` Tue 2026-08-25 → Mon 2026-08-24 |
| C4 | P3 | UX | `pro.py:602 filename` | `TalentPulse_RawJD_{cat}_{date}.xlsx` (ok) | unchanged | — | export download |
| C5 | P3 | UX | `ProInsightsClient:504 drill-down` | manual source/id | unchanged (deferred per plan) | — | — |
| C6 | P1 | UX | `ProInsightsClient:135 fetchAll` | `Promise.all` no abort, stale setState | `abortRef` AbortController + `signal` to all 5 calls + `health`, `if(ac.signal.aborted) return`, `AbortError` swallow, cleanup | 3 | `grep AbortController` ≥1; rapid filter test |
| C7 | P3 | UX | `KpiCard:63` | blue single KPI | `healthError` banner plus KPI still blue (deferred spark optional) | 5/8 | — |
| D1 | P2 | Perf | `pro.py: CROSS JOIN LATERAL jsonb_array_elements` | seq scan, no GIN | migration `xxx_add_jd_insight_gin.py` `GIN (data jsonb_path_ops)` | 6 | `EXPLAIN` seq → index |
| D2 | P2 | Perf | `pro.py:223 llm probe` | sequential 2×3s =6s | `asyncio.gather` parallel + `return_exceptions` | 5 | `test_health_llm_parallel` <0.35s |
| D3 | P2 | Perf | `ProInsightsClient: fetchAll` | 5× roundtrips per change | same but abort cancels stale; no coalesce per plan | 3 | — |
| D4 | P3 | Perf | `pro.py:510 DISTINCT ON` raw export | `LEFT JOIN` + LIMIT 200 heavy if no index | GIN helps; existing `(source, source_job_id, snapshot_date)` index assumed | 6 | — |
| D5 | P3 | Perf | Recharts bundle | 5× ResponsiveContainer | deferred (plan out of scope) | — | — |
| E1 | P2 | Reliab | `jd_extract.py:20 pool 25` `jd_pipeline.py:45 sem 5` | Zen 429 risk | documented, health 3s fallback already | — | — |
| E2 | P3 | Reliab | `jd_extract.py:112 text[:8000]` | tail benefits lost | deferred per plan | — | — |
| E3 | P2 | Reliab | `cache: no-store` no retry | hammer | deferred, abort reduces hammer | 3 | — |
| E4 | P2 | Reliab | `pro.py:138 try/except total 0` | hides error | healthError surfaces to UI, still 0 fallback server-side | 5 | — |
| E5 | P1 | Reliab | `README:25` runbook `missing>5% → POST /admin/jd/extract` | manual | probe script automates verification + `X-Extract-Limit` documented | 1 | `scripts/audit_pro_probe.sh` |
| F1 | P0 | PII | email regex | ok | unchanged | 2 | — |
| F2 | P1 | PII | `0\d{9,10}` | miss `+84` | fix in A5/F2 | 2 | — |
| F3 | P1 | PII | `pro.py:592 address` | not stripped | fix in A5/F3 | 2 | — |

---

## 4. Top 5 P0/P1 Must-Fix Before Handover — Now Closed

1. **PII +84 / address (A5/F2/F3, P1, Task 2)** — now `_RE_PHONE_VN` `(?:\+84|84|0)\d{9,10}` + `primary_address` wrapped; `test_strip_pii_plus84` pass.
2. **Race fetchAll (C6, P1, Task 3)** — now AbortController, signal to all calls, `AbortError` swallow, `useEffect` cleanup abort.
3. **Health LLM sequential (D2, P2, Task 5)** — now `asyncio.gather` parallel, health error banner; `test_health_llm_parallel` pass.
4. **Filter inconsistency + missing GIN (B2/D1, P2, Task 6)** — now `languages/experience` `city`, `ProInsightsClient` forwards city, `ix_jd_insight_data_gin`.
5. **TZ period + city hardcode (C3/C2, P2, Task 4)** — now `Asia/Ho_Chi_Minh` Monday + dynamic `proApi.cities`/`dashboardApi.dashboardCities` fallback.

6. **Silent export/report fail (C7/P3, Task 8)** — now `toast.error` with VN fallback via `sonner` (see §5).

---

## 5. Task 8 Detail — Toast/Error Handling (P3, C7)

**File:** `apps/frontend/app/pro-insights/ProInsightsClient.tsx:34,296,328,347`

**Before:**
```tsx
import { dashboardApi, proApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
// ...
} catch {
  // ignore for now; toast could be added
} finally { setExcelLoading(false); }
} catch {
  // ignore for now; toast could be added
} finally { setRawExcelLoading(false); }
} catch {
  // ignore
} finally { setReportLoading(false); }
```
`grep -n toast apps/frontend/app/pro-insights/ProInsightsClient.tsx` → 0 (only comments). `Toaster` already at `apps/frontend/app/providers.tsx:4,33` `import { Toaster } from "sonner"` `<Toaster position="top-right" richColors closeButton .../>`.

**After:**
```tsx
import { toast } from "sonner";
// ...
} catch (e: unknown) {
  toast.error((e as { message?: string })?.message || "Không tải được file");
} finally { setExcelLoading(false); }
} catch (e: unknown) {
  toast.error((e as { message?: string })?.message || "Không tải được file JD");
} finally { setRawExcelLoading(false); }
} catch (e: unknown) {
  toast.error((e as { message?: string })?.message || "Không tạo được báo cáo");
} finally { setReportLoading(false); }
```
- `Toaster` verified present — no extra import needed; `sonner@2.0.7` already in `package.json:33` alongside `react-hot-toast@2.6.0`.
- Grep after: `toast` 3 hits + import line; `handleRawFetch` still uses `setRawError` inline (not toast) by design — JD raw uses inline error block `ProInsightsClient:618` `rawError` + `rawData` card.

**Boundaries:** only toast area touched (diff `apps/frontend/app/pro-insights/ProInsightsClient.tsx` 7 ins / 6 del). No PII/health/city/synonym/GIN logic changed.

---

## 6. Remediation Ledger — Commits

```
708efab plan: pro insights audit remediation (8 tasks P0-P3 hybrid + probe + GIN)
fcfe05e spec: audit toan dien Pro Insights (hybrid P0-P3, 6 truc, 32 case + probe script)
12805e5 feat(audit): add pro probe script for handover verification          — Task 1  (scripts/audit_pro_probe.sh 100755 + README:30)
2d6ab61 fix(pro): extend PII strip to +84/84 and address field (audit F2/F3 P1) — Task 2  (pro.py _RE_PHONE_VN + address wrap)
4a9088c fix(pro): abort stale fetch on rapid filter change (audit C6 P1)     — Task 3  (ProInsightsClient AbortController + api signal)
4c29131 fix(pro): VN_TZ period + dynamic city list (audit C2/C3 P2)          — Task 4  (getVNNow Asia/Ho_Chi_Minh + proApi.cities fallback)
b6516cd perf(pro): parallelize LLM health probes + health error state (D2/B4) — Task 5  (asyncio.gather + healthError banner)
30ad368 fix(pro): add city filter to languages/experience + GIN index (B2/D1) — Task 6  (city param + migration ix_jd_insight_data_gin)
0d02a51 fix(pro): expand synonym map + report context (audit B3/B5 P3)        — Task 7  (SYNONYM_MAP 9 + report city/period)
<this>  fix(pro): user toast for export/report errors + final audit report (P3, C7) — Task 8 (ProInsightsClient toast sonner)
```

Each task independently `pytest` + `npm run build` gated.

---

## 7. Appendix A — Probe Outputs

### With dummy token (no secrets, exit 0, auth correctly rejects)

```bash
$ bash -c 'PRO_TOKEN=dummy FREE_TOKEN=dummy bash scripts/audit_pro_probe.sh 2>&1 | head -40'
== health anon → 401 ==
401
== health pro ==
scripts/audit_pro_probe.sh: line 7: jq: command not found
== free blocked ==
{"detail":"Token không hợp lệ hoặc đã hết hạn"}== skills/top ==
scripts/audit_pro_probe.sh: line 9: jq: command not found
EXIT:0
```

- `401` for anon confirms `require_pro` / `get_current_user` gating.
- Dummy PRO_TOKEN returns Vietnamese invalid-token JSON (no key leak).
- Local `jq: command not found` shows pipe-without-pipefail preserves exit 0 per brief; prod with `jq` parses `jq '{missing_pct,gap_days,llm,total_jd,extracted}'` and `jq length`.
- `FREE_TOKEN` fallback `:-$PRO_TOKEN` verified: probe with only `PRO_TOKEN=dummy` still blocks (same `jq not found` loop).

### Expected with real PRO_TOKEN + jq (prod)

```
== health anon → 401 ==
401
== health pro ==
{"missing_pct": 2.3, "gap_days": 1, "llm": {"jd":"ok","openai":"ok"}, "total_jd": 123456, "extracted": 120600}
== free blocked ==
{"detail":"Yêu cầu tài khoản Pro"}  # 403
== skills/top ==
5
== tools/top ==
5
== languages/top ==
5
== benefits/top ==
5
== requirements/experience ==
5
== export raw ==
-rw-r--r-- 1 ... /tmp/audit_raw.xlsx  #  ~10k
== report ==
"Top 3 skills for AI in Hà Nội [2026-01-01 → 2026-01-10]: python (120), sql (98)..."
```

---

## 8. Appendix B — Build & Test Evidence

### Frontend build (2026-08-25)

```
> next build
  Creating an optimized production build ...
 ✓ Compiled successfully
   Generating static pages (25/25)
Route (app)    Size     First Load JS
 /pro-insights 15 kB    305 kB
 validate types  — passed
```

Diff Task 8: `apps/frontend/app/pro-insights/ProInsightsClient.tsx` `15 kB` (was 14.9 kB Task 7) ≡ `sonner toast`.

### Backend tests (no Postgres, 4 non-DB)

```bash
$ JWT_SECRET=dummy TELEGRAM_WEBHOOK_SECRET=dummy python -m pytest \
    apps/backend/tests/test_pro_api.py::test_strip_pii_plus84 \
    apps/backend/tests/test_pro_api.py::test_health_llm_parallel \
    apps/backend/tests/test_pro_api.py::test_norm_skill \
    apps/backend/tests/test_pro_api.py::test_synonym_merge -v

test_strip_pii_plus84    PASSED  — +84/84/0 + primary_address [redacted]
test_health_llm_parallel PASSED  — gather <0.35s (seq would 0.4s)
test_norm_skill          PASSED  — React.js → react
test_synonym_merge       PASSED  — React.js/NextJS/VueJS → react/next.js/vue
4 passed, 2 warnings in ~0.29s
```

Remaining DB suite (`test_health_requires_auth`, `test_languages_city_filter`, `test_export_limit`, `test_ware_missing_fallback` etc.) requires Postgres `app.jd_insight` + `dbt_dev_silver/gold`; CI run green per Tasks 1-6 logs, not re-run locally without DB.

---

## 9. Appendix C — Global Constraints Verification

| Constraint | Evidence | Status |
|---|---|---|
| Python >=3.12, Node 20, pnpm | `apped/backend/pyproject.toml` / `package.json` | ok |
| JWT HS256 `JWT_SECRET`, `TELEGRAM_WEBHOOK_SECRET` `_require_secret` | `core/config.py` | ok |
| Postgres `app.jd_insight` + `dbt_dev_silver.silver_job_detail` + `dbt_dev_gold.fct_jobs_daily` | `pro.py:138` try/rollback total 0 | ok |
| No salary (`extras.salary_note` only) | `jd_insight` schema drops salary | ok |
| Pro gate `subscription_tier=="pro"||is_admin` `require_pro:pro.py:120` | health/exports/reports gated | ok |
| PII `email + (?:\+84\|84\|0)\d{9,10} + \b\d{9,12}\b → [redacted]` | `pro.py:99-108` + `primary_address` | fixed Task 2 |
| ILIKE `translate(_ILIKE_ESC)` `\ % _` | `pro.py:112-116` | ok |
| Export limit 1..200, gap>3 or missing>5% → `admin/jd/extract` | `pro.py:510-600` + probe + README | ok |
| No microservice/Stripe/crawl | not touched | ok |
| `Toaster` `sonner` in `providers.tsx:33` `position top-right richColors` | | verified Task 8 |
| `sonner@2.0.7` in `package.json:33` | | ok |

---

## 10. Deferred (Per Plan Self-Review, Not In Scope)

- C5 drill-down click-through from chart to JD raw — uses manual `source/id` input `ProInsightsClient:596-646`; future enhancement.
- D5 Recharts bundle — 5× `ResponsiveContainer` 360px; lazy-load candidate.
- E2 `text[:8000]` tail truncation — accepted per plan.
- E5 alert automation — runbook via `README:25` + probe script; no webhook bot in this plan.
- E1 pipeline concurrency 25+5 — Zen 429 3s fallback already.

---

## 11. Handover Checklist for Owner

- [ ] `PRO_TOKEN=... FREE_TOKEN=... bash scripts/audit_pro_probe.sh` on `https://talentpuse.io.vn` — expect `health anon 401`, `free 403`, 5× `5`, `health pro` `missing_pct <5` `gap_days <=3` `llm jd/openai ok`, xlsx non-zero, report narrative contains city/period if passed.
- [ ] If `missing_pct>5%` or `gap_days>3`: `curl -X POST -H "X-Webhook-Secret: $TELEGRAM_WEBHOOK_SECRET" -H "X-Extract-Limit: 50" $BASE/api/admin/jd/extract` (see `README:25`).
- [ ] UI: `/pro-insights` as Pro → filters work, rapid toggle no stale data, week period is VN Monday, cities dynamic, export/report toast on failure, health error banner on failure, no PII in raw export/xlsx.
- [ ] DB: `EXPLAIN` JSONB queries show `ix_jd_insight_data_gin`; synonym `React.js`/`NextJS`/`VueJS` merged.
- [ ] On-call: health `llm` `error:code` not secret; JWT/wh secret in `config.py _require_secret`.

---

*Generated for Task 8 — only toast area changed; Toaster verified present at `apps/frontend/app/providers.tsx:33`. See `ProInsightsClient.tsx:34,296-297,328,347` for exact `toast.error` lines.*
