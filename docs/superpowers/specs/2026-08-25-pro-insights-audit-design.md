# Audit Toàn Diện Pro Insights — `https://talentpuse.io.vn/pro-insights`

Date: 2026-08-25
Status: Approved (Hybrid Approach 3)
Stakeholders: Owner (handover), Paying Pro customers, Eng team pre-scale
Scope: A+B+C — frontend + backend pro + full JD pipeline + Paid API + auth/PII
Severity: P0-P3 toàn hướng (Security, Data Quality, UX, Performance, Reliability, PII)

## 1. Problem & Goals

Trang Pro Insights đã live (8 endpoints `/api/pro/*` + 5 charts Recharts + export xlsx/report) nhưng chưa từng được audit handover đa chiều. Rủi ro: nếu `missing_pct >5%` hoặc `gap_days >3` mà không phát hiện, data bán cho Pro sai; nếu `require_pro` bypass hoặc `_strip_pii` sót, lộ PII/key; nếu `fetchAll` race hoặc `period` lệch TZ, UX sai số.

Goal: báo cáo audit duy nhất, có bằng chứng `file:line` + `curl` tái hiện + mức P0-P3 + effort S/M/L, kèm script probe để owner tự verify 100k/lỗi, làm cơ sở cho plan fix P0→P3.

## 2. Current Architecture (ground truth)

**Frontend:** `apps/frontend/app/pro-insights/page.tsx:1` force-dynamic → `ProInsightsClient.tsx:101` client 562 lines. `layout.tsx:5` double guard `ProtectedRoute` + `subscription_tier !== 'pro' && !is_admin` upsell. Filters `category/city/jobTitle/period` state, `getPeriodDates()` week Mon-Sun, month 1→end. `fetchAll` Promise.all 5× `proApi.*Top` + `health`. Charts: `SkillsBar`, `ToolsBar`, `LanguagesDonut`, `BenefitsBar`, `ExperienceBuckets` (Recharts + `lib/chart-theme.ts`). Exports 2 nút `kind=all` + `kind=raw` via `proApi.exportXlsx:1549` Blob URL.

**Backend:** `apps/backend/app/api/pro.py:17` router `/api/pro` 8 routes: `/health`, `/skills/top`, `/tools/top`, `/languages/top`, `/benefits/top`, `/requirements/experience`, `/export.xlsx?kind=...`, `/report` POST, `/jobs/{source}/{id}/insight`, `/jobs/{source}/{id}/raw`. Mỗi route `Depends(require_pro)` at `pro.py:120` → `core/security.py:38 get_current_user` JWT HS256. Helpers `_filter_sql:26`, `_date_filter_sql:82`, `_khoang_ngay_pro:37` VN_TZ, `_strip_pii:102` regex email/phone, `_like_pattern:115` ILIKE escape. Model `app.jd_insight:12` JSONB `data` schema `schemas/jd_insight.py:77` (JdInsight). Warehouse `dbt_dev_silver.silver_job_detail` (>100 chars) + `dbt_dev_gold.fct_jobs_daily` is_active.

**Pipeline:** `services/jd_extract.py:73 _call_llm` 25-thread pool, JSON mode retry, prompt 71 lines, slice `text[:8000]`, fallback JD_LLM→OPENAI, `services/jd_insight_repo.py:12 upsert` `uq_jd_insight_source_job`, `services/jd_pipeline.py:25 run_extract_pipeline` semaphore 5, `get_missing_job_keys` length desc+req >100. Trigger `POST /api/admin/jd/extract` header `X-Webhook-Secret` + `X-Extract-Limit` at `admin.py:330`. Prefect daily.

**Tests:** `tests/test_pro_api.py` 337 lines (health 401/403/200, skills/tools, export xlsx, raw PII, date filter 422, ILIKE escaping), `tests/test_jd_*.py` etc.

## 3. Severity Rubric

- **P0 Critical** — Bypass Pro gate, leak PII/API key, 500 diện rộng, mất data, handover blocker. Fix trước khi bán/giao.
- **P1 High** — Data sai/lag `gap>3`/`missing>5%`, PII sót `+84`, race condition, perf p95>2s, health sai.
- **P2 Medium** — Filter không nhất quán (languages thiếu city), period lệch TZ, thiếu error/skeleton, thiếu index GIN, synonym thiếu.
- **P3 Low** — Hardcode 7 city, thiếu toast, i18n narrative hardcode, copy.

Mỗi issue: `ID | P? | Trục | file:line | Mô tả | Bằng chứng | Tái hiện | Effort S/M/L`

## 4. Audit Matrix — 6 Trục × 32 Case

### A. Security & AuthZ (6 case)
| ID | Case | Expect | Evidence/Line | Risk |
|---|---|---|---|---|
| A1 | Anon GET /api/pro/* | 401 | `pro.py:120 require_pro` Depends `get_current_user` → 401, test `test_health_requires_auth:6` | OK |
| A2 | Free GET /skills/top | 403 | `pro.py:121 tier != pro && !is_admin` | OK |
| A3 | Free export raw leak | 403 | `pro.py:419 export_xlsx` same guard, frontend `layout.tsx:7` only UI hide — backend enforces | Verify prod curl free token 403 |
| A4 | ILIKE injection via title | escaped | `pro.py:115 _like_pattern` `translate(_ILIKE_ESC)`, test `test_export_raw_title_filter_escaping:215` | OK |
| A5 | PII leak raw | stripped | `pro.py:102 _strip_pii` 3 regex, applied `/raw:752` + export `582`, test assert no email/phone | Miss `+84`/`84` prefix, 12-digit edge |
| A6 | Webhook secret / LLM probe leak | no key leak | `admin.py:336` check, `pro.py:223 llm probe` returns `ok/error:code` not key | Confirm health response never contains key |

### B. Data Quality & Freshness (6 case)
| B1 | missing_pct/gap_days | `total` silver >100 vs `extracted` count, `gap = max_posted - max_extracted` `pro.py:126-221` | Alert `>5%/>3d` per README:25 |
| B2 | Filter consistency | `_filter_sql` category+city, `_date_filter_sql` alias i, but `languages_top` no city, `experience` no city | Inconsistent UX |
| B3 | Synonym merge | `SYNONYM_MAP:19` 4 entries only, merge after GROUP BY `pro.py:301` | Missing react.js variants |
| B4 | Empty/error state | `ProInsightsClient:411` shows "Không có dữ liệu" but health card hidden if null `395` | Needs error state |
| B5 | Report narrative | `pro.py:692` hardcode template top3 skills/tools + gap | Needs i18n/context |
| B6 | health date filter | `pro.py:127` respects date_from/to, compute gap same | Verify with date params |

### C. UX / Functional (7 case)
| C1 | Category load empty | `dashboardApi.categories()` public, no pro gate | If warehouse empty → empty select |
| C2 | City hardcode 7 | `ProInsightsClient:36 CITIES` | Missing provinces |
| C3 | Period TZ | `formatLocal` uses browser TZ, `_khoang_ngay_pro` uses VN_TZ extend 23:59:59.999 | Lệch 7h if browser not VN |
| C4 | Export filename | `pro.py:602 TalentPulse_RawJD_{cat}_{date}.xlsx` | OK |
| C5 | JD drill-down | Manual source/id input `504` placeholder | No click-through from chart |
| C6 | Race fetchAll | `ProInsightsClient:135 Promise.all` no AbortController, rapid filter change → stale setState | Compare with `jobsApi.list:588` has signal |
| C7 | Health KPI accent | `KpiCard:63` blue only | Single metric, missing missing% spark context |

### D. Performance (5 case)
| D1 | JSONB scan | `CROSS JOIN LATERAL jsonb_array_elements` no GIN index on `data->'skills'->'hard'` | EXPLAIN seq scan if >50k rows |
| D2 | Health LLM probe seq | `pro.py:223` two awaits sequential `jd` then `openai` each 3s timeout | 6s health latency |
| D3 | Parallel fetch | 5× proApi parallel no coalesce | 5 roundtrips per filter change |
| D4 | Raw export WITH latest_gold | `pro.py:510 DISTINCT ON + LEFT JOIN` LIMIT 200 | Heavy if no index on (source, source_job_id, snapshot_date) |
| D5 | Recharts bundle | 5× ResponsiveContainer 360px | Initial JS large |

### E. Reliability / Ops (5 case)
| E1 | Pipeline concurrency | `jd_extract.py:20 pool 25` + `jd_pipeline.py:45 sem 5` | Zen 429 risk |
| E2 | Text truncation | `jd_extract.py:112 text[:8000]` | Loses benefits at tail |
| E3 | No cache/retry frontend | `cache: no-store` every filter change, no retry | Hammer warehouse |
| E4 | Warehouse missing fallback | `pro.py:138 try/except rollback` total 0 | Health hides error instead of 503 |
| E5 | Handover runbook | README:25 `missing>5% → POST /admin/jd/extract` with `X-Extract-Limit:50` | Needs automation alert |

### F. PII / Compliance (3 case)
| F1 | Email regex | `[A-Za-z0-9._%+\-]+@...` | Miss unicode? ok |
| F2 | Phone +84 | `0\d{9,10}` + `\b\d{9,12}\b` | Miss `+84 9xx` |
| F3 | Export PII stripped | `pro.py:592` _strip_pii on desc/req only | `primary_address` not stripped |

## 5. Methodology (Hybrid)

1. Static scan: đã đọc toàn bộ file trên, ghi file:line.
2. Automated probe script `scripts/audit_pro_probe.sh` (read-only then full):
```bash
#!/bin/bash
set -e
BASE=https://talentpuse.io.vn
PRO_TOKEN=${PRO_TOKEN:?}
FREE_TOKEN=${FREE_TOKEN:?}
echo "== health anon → 401 =="; curl -s -o /dev/null -w "%{http_code}\n" $BASE/api/pro/health | grep 401
echo "== health pro =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/health?date_from=2026-01-01" | jq '{missing_pct,gap_days,llm}'
echo "== free blocked =="; curl -s -H "Authorization: Bearer $FREE_TOKEN" $BASE/api/pro/skills/top | grep 403
for ep in skills/top tools/top languages/top benefits/top requirements/experience; do echo "== $ep =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/$ep?limit=5" | jq length; done
echo "== raw PII =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/jobs/vietnamworks/123/raw" | jq .job_description_text | grep -v "[redacted]" || echo "PII stripped ok"
echo "== export raw =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/export.xlsx?kind=raw&title=Engineer%25&limit=5" -o /tmp/audit_raw.xlsx && ls -lh /tmp/audit_raw.xlsx
echo "== report =="; curl -s -X POST -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/report?category=AI" | jq .narrative
```
3. UI manual: 3 accounts (anon/free/pro) load /pro-insights, rapid filter toggle, click export/report/raw.
4. DB: `EXPLAIN` JSONB queries, compare `SELECT count(*) silver >100` vs `app.jd_insight`.

## 6. Deliverable Structure

Single markdown spec at `docs/superpowers/specs/2026-08-25-pro-insights-audit-design.md`:
1. Executive summary (3 lines + P0/P1/P2/P3 counts)
2. Methodology (above)
3. Detailed issue table 25-32 rows (ID | P? | Trục | file:line | Mô tả | Bằng chứng | Tái hiện | Effort)
4. Top 5 P0/P1 must-fix before handover
5. Appendix: live probe output (missing_pct, gap_days, LLM health), UI screenshots 3 states, EXPLAIN.

Also `scripts/audit_pro_probe.sh` for verifiable 100k/bug.

## 7. Out of Scope & Risks

OUT: Stripe/manual billing, `pipeline_data` crawl, splitting microservice.
Risks: Zen 429 → health 3s fallback already; warehouse missing → try/rollback hides 0; text[:8000] cut accepted.
Mitigation: add GIN index recommendation, add AbortController, fix period TZ, extend _strip_pii for +84.

## 8. Next Step

After spec approved → invoke `writing-plans` to break into tickets P0→P3 with blocking edges, each ticket references audit ID and reproduction curl.
