# Pro Insights — Paid Data Interface for Pro Accounts

Date: 2026-08-23
Status: Approved (Approach B)
Stakeholder: TalentPulse owner + paying customers (handover-ready)

## Problem

Paid API (`/api/v1/*` reading `app.jd_insight` in `apps/backend/app/api/paid.py:62`) exists but has no web interface. Customers get an `X-API-Key` and "don't know how to get data out" (`paid.py:31` requires header, quota in `paid_quota.py:21`). Owner wants pro accounts to see rich market data directly in the sidebar instead of holding a raw API, before handover. Previous handover audit also flagged LLM key expiry (`JD_LLM_API_KEY` at `https://opencode.ai/zen/v1`, fallback `OPENAI_API_KEY` at `https://openrouter.ai/api/v1` in `apps/backend/app/services/jd_extract.py:23`) and missing extractions (`get_missing_job_keys` in `jd_insight_repo.py:36`) causing `jd_insight` to lag behind `silver_job_detail` (>100 chars).

Goal: a self-serve Pro page that fetches via JWT (not API key), visualizes, and lets pro users download Excel / generate a per-industry report (AI, Data, SWE... = `job_category`), while keeping the gate auditable for handover.

## Goal

Pro users (`subscription_tier == 'pro'` in `app.models.user.User` at `apps/backend/app/models/user.py:16`) see a new "Pro Insights" page in the sidebar. It visualizes `app.jd_insight` aggregates (skills/tools/languages/benefits/experience) per `job_category`/`city`, with Excel export and one-click report. Free users never see it. Data source is exactly what Paid API sells, so web and API stay consistent.

## Scope

IN (Approach B — dedicated module):
- Sidebar gating (`nav-items.ts`, `SideNav.tsx`, `DashboardSidebar.tsx`)
- New backend router `apps/backend/app/api/pro.py` with 6 read endpoints + `export.xlsx` + `report` + `health`
- New frontend route `apps/frontend/app/pro-insights/` (layout + page + client) reusing chart patterns from `DashboardClient.tsx`
- Excel export via `openpyxl`, report narrative via template + optional `skill_advisor_chain`

OUT:
- Warehouse crawl/dbt sync (lives in `pipeline_data`, not this repo)
- Changing `paid.py` / `X-API-Key` flow — keep it for external API customers
- Auto-extract on pro request (extraction stays on cron `POST /api/admin/jd/extract` at `admin.py:330`)
- Multi-tenant API key per pro user (Approach C)

## Current Architecture

- **Warehouse → web box:** daily one-way sync into `dbt_dev_gold.fct_jobs_daily`, `dbt_dev_silver.silver_job_detail`, `dbt_dev_silver.silver_skill_long` + local `app.jd_insight` (populated by `jd_pipeline.py:25` → `jd_extract.py:73` → `jd_insight_repo.py:15`)
- **Dashboard public:** `GET /api/overview`, `/api/dashboard/cities|levels`, `/api/skills/top`, `/api/companies/top` reading gold marts (`overview.py:11`, `skills.py:10`)
- **Paid API:** 5 endpoints in `paid.py:62` reading `app.jd_insight` with `CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'hard')` and `_filter_sql(category, city)` at `paid.py:51`
- **Frontend shell:** `SideNav.tsx:19` + `nav-items.ts:21` + `AuthContext.tsx` (`subscription_tier` in `lib/api.ts:UserResponse`)
- **Charts:** `SkillsBar`, `CitiesBar`, `LevelsBar`, `CompaniesTable`, `KpiCard`, theming via `lib/chart-theme.ts` and `cn()` (`lib/utils.ts`)

## Design

### 1. Navigation & Gating

**Frontend:**
- Extend `apps/frontend/components/shell/nav-items.ts:21`:
  ```ts
  export const PRO_ITEM: NavItem = { href: "/pro-insights", label: "Pro Insights", icon: Sparkles, proOnly: true }
  ```
  Add `proOnly?: boolean` to `NavItem`. Keep `NAV_ITEMS` unchanged; export `PRO_ITEM` separately.
- Update `apps/frontend/components/shell/SideNav.tsx:19`:
  ```ts
  const items = [...NAV_ITEMS, ...(user?.subscription_tier === 'pro' || user?.is_admin ? [PRO_ITEM] : [])]
  ```
  Mirror in `apps/frontend/components/dashboard/DashboardSidebar.tsx:40` if still used. Active check via `isActiveRoute`.
- Create `apps/frontend/app/pro-insights/layout.tsx` wrapping `DashboardLayout` + `ProtectedRoute` + client guard: if `!pro && !admin` → render upsell card linking `/pricing` (not redirect loop).
- Add `PRO_ITEM` to `CommandMenu` source so `Cmd+K` finds it.

**Backend:**
- Dependency `require_pro` in `api/pro.py`:
  ```py
  async def require_pro(user: User = Depends(get_current_user)):
      if user.subscription_tier != "pro" and not user.is_admin:
          raise HTTPException(403, "Pro subscription required")
      return user
  ```
  Reuse `app.core.security.get_current_user`. No quota decrement (unlike `paid_quota.verify_key`).

### 2. Backend API — `apps/backend/app/api/pro.py`

Router `APIRouter(prefix="/api/pro", tags=["pro"])`, include in `app/main.py:147`.

**Read endpoints (auth `Depends(require_pro)`):**

| Endpoint | Query | SQL pattern (copied from `paid.py:73`) |
|----------|-------|----------------------------------------|
| `GET /skills/top` | `category?`, `city?`, `limit=20` | `SELECT lower(btrim(s.skill)) AS skill, count(*)::int FROM app.jd_insight i CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'hard') AS s(skill) WHERE 1=1 {extra} GROUP BY 1 ORDER BY n_jobs DESC` + synonym merge `SYNONYM_MAP` at `paid.py:18` |
| `GET /tools/top` | `category?`, `city?`, `limit=20` | `... i.data->'skills'->'tools' ...` |
| `GET /languages/top` | `category?`, `limit=20` | `l->>'lang', l->>'level'` from `i.data->'skills'->'languages'` |
| `GET /benefits/top` | `category?`, `city?`, `limit=20` | `i.data->'benefits'` |
| `GET /requirements/experience` | `category?` | `CASE WHEN (i.data->'requirements'->'years_experience'->>'min')::int ... END AS bucket` at `paid.py:159` |
| `GET /jobs/{source}/{id}/insight` | path | `jd_insight_repo.get_insight` |

Helper `_filter_sql` identical to `paid.py:51`:
```py
def _filter_sql(category, city=None, alias="i"):
    conds, params = [], {}
    if category: conds.append(f"{alias}.data->'job'->>'job_category' = :category")
    if city: conds.append(f"{alias}.data->'job'->>'city_canonical' = :city")
    return (" AND " + " AND ".join(conds)) if conds else "", params
```

**Export:**
- `GET /export.xlsx?category=&city=&kind=skills|tools|languages|benefits|all&limit=100`
  - Runs same queries with higher limit, builds workbook via `openpyxl.Workbook`: one sheet per kind, header row, `skill/n_jobs` etc. Single `kind=all` creates 5 sheets.
  - Returns `StreamingResponse` with `Content-Disposition: attachment; filename="TalentPulse_Pro_{category or 'All'}_{date}.xlsx"` and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - Cap `limit` 1..200 to avoid OOM.

**Report:**
- `POST /report?category=AI` (body empty, category in query)
  - Calls the 5 read helpers internally, computes `topSkills`, `topTools`, `experience`, then builds `narrative` (try `skill_advisor_chain` if `OPENAI_API_KEY` available, else string template: "Top 3 skills for {category} are X/Y/Z, most jobs require 2-3 years...").
  - Return `{ generated_at: ISO, category, narrative, tables: { skills, tools, languages, benefits, experience }, data_note: "Based on {extracted} jobs, missing {missing} ({pct}%)" }`.

**Health (for freshness badge, also used by handover audit):**
- `GET /health` (pro or admin)
  ```sql
  -- total JD with text >100
  SELECT count(*) FROM dbt_dev_silver.silver_job_detail d WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100
  -- extracted
  SELECT count(*) FROM app.jd_insight
  -- missing = total - extracted (or via NOT EXISTS as in jd_insight_repo.py:36)
  -- max dates
  SELECT max(snapshot_date), max(posted_at) FROM dbt_dev_gold.fct_jobs_daily WHERE is_active
  SELECT max(extracted_at) FROM app.jd_insight
  ```
  Plus live LLM probes: `httpx.post` empty `chat/completions` to `JD_LLM_BASE_URL` and `OPENAI_BASE_URL` with `_auth_headers` from `jd_extract.py:32`, capture `200` vs `401/429`.
  Return `{ total_jd, extracted, missing, missing_pct, max_posted_at, max_extracted_at, gap_days, llm: { jd: "ok"|"error:401", openai: "ok"|"fail" } }`.
  Used by frontend to show warning banners; also satisfies Mức 3 audit.

**Error handling:**
- Invalid `category` → `[]` or `0` (not 500), same coalesce pattern as `overview.py:34`.
- `category`/`city` with zero matches → empty arrays, Excel with only header row, report narrative notes "No data for this filter".

### 3. Frontend Page & Visuals

**Routing:**
- `apps/frontend/app/pro-insights/page.tsx` (server): `dynamic = "force-dynamic"`, fetches `proApi.health()` + `categories` via `lib/api.ts` (new `proApi` object), passes as props.
- `apps/frontend/app/pro-insights/ProInsightsClient.tsx` (client): holds `category`, `city`, `limit` state, calls `proApi.skillsTop` etc. in `useCallback` + `useEffect` mirroring `DashboardClient.tsx:79`.

**Components (reuse + new):**
- Reuse `Card`, `KpiCard`, `SkillsBar` (already themed with `useChartTheme`), `Select` from `components/ui/select`.
- New: `ToolsBar.tsx` (clone `SkillsBar` with `tool` field), `LanguagesDonut.tsx` (Recharts `Pie`), `BenefitsBar.tsx`, `ExperienceBuckets.tsx`. All use `chart-theme.ts` tokens `--chart-1..6`.
- Layout: header with KPI row (3 cards: extracted/missing/gap_days), filter bar (Category `Select`, City `Select`, Limit `Select`), grid 2-col: Skills + Tools, full-width Languages Donut, grid 2-col: Benefits + Experience, full-width Table `TopInsightJobs`.
- Visual style via `ui-ux-pro-max` (shadcn + Tailwind, `cn()`).

**API client:**
- Extend `apps/frontend/lib/api.ts` with `proApi`:
  ```ts
  export const proApi = {
    health: (token) => clientFetch<Health>(`/api/pro/health`, { headers: authHeaders(token) }),
    skillsTop: (token, params) => clientFetch<SkillRow[]>(`/api/pro/skills/top?...`, { headers: authHeaders(token) }),
    // ...toolsTop, languagesTop, benefitsTop, experience, insight
    exportXlsx: (token, params) => fetch blob,
    report: (token, category) => clientFetch<Report>(`/api/pro/report?category=`, { method:"POST", headers: authHeaders(token) }),
  }
  ```
  Add types `Health`, `Report`, `ExperienceBucket`.

**Interactions:**
- Filter change → refetch all charts in parallel (`Promise.all`).
- "Tải Excel" → `proApi.exportXlsx` → create object URL → `a.download`.
- "Generate Report" → `proApi.report` → render markdown via `react-markdown` + tables + "Tải PDF" (optional: call `tp-latex` or print).

### 4. Files Touched

Backend:
- `apps/backend/app/api/pro.py` (new, ~250 lines)
- `apps/backend/app/main.py` (1 line: include router)
- `apps/backend/requirements.txt` or `pyproject.toml` (add `openpyxl>=3.1` if missing)
- `apps/backend/tests/test_pro_api.py` (new)

Frontend:
- `apps/frontend/components/shell/nav-items.ts` (add `PRO_ITEM`)
- `apps/frontend/components/shell/SideNav.tsx` (gate filter)
- `apps/frontend/components/dashboard/DashboardSidebar.tsx` (mirror gate)
- `apps/frontend/lib/api.ts` (add `proApi` + types)
- `apps/frontend/app/pro-insights/page.tsx` (new)
- `apps/frontend/app/pro-insights/layout.tsx` (new)
- `apps/frontend/app/pro-insights/ProInsightsClient.tsx` (new, ~200 lines)
- `apps/frontend/components/ToolsBar.tsx`, `LanguagesDonut.tsx`, `BenefitsBar.tsx`, `ExperienceBuckets.tsx` (new, each ~80 lines)
- `apps/frontend/package.json` (add `openpyxl` is backend only; frontend adds `react-markdown` if missing)

Docs:
- `docs/superpowers/specs/2026-08-23-pro-insights-design.md` (this file)

### 5. Data Flow

```
silver_job_detail (JD text >100) --jd_extract.py:73 (JD_LLM_* -> OPENAI_*)--> jd_insight_repo.upsert
                                                                               |
fct_jobs_daily (is_active) ---------------------------------------------------> pro.py reads jd_insight (filtered by category/city)
                                                                               |
JWT (AuthContext) + require_pro (tier check) --> proApi (frontend) --> charts / Excel / report
```

### 6. Testing & Handover

- Backend: `pytest apps/backend/tests/test_pro_api.py` — 200 for pro, 403 for free, 401 for no token, sheet count for `kind=all`.
- Frontend: `npm run lint && npm run build` in `apps/frontend`, Playwright `pro-insights.spec.ts` (free invisible, pro visible, filter changes, Excel >1KB).
- Handover audit: `curl -H "Authorization: Bearer $PRO_TOKEN" https://talentpuse.io.vn/api/pro/health` shows `missing_pct` and `gap_days`; if `missing >5%` or `gap_days >3` → run `curl -X POST -H "X-Webhook-Secret: $SECRET" -H "X-Extract-Limit: 200" https://.../api/admin/jd/extract`.

## Open Questions for Implementation

- Exact `subscription_tier` values for pro: currently `free` default at `models/user.py:16`; confirm `pro` vs `premium` with owner before gating.
- Whether `skills/top` synonym merge (`SYNONYM_MAP`) should also apply to `tools/top` — defer to implementation.
- PDF via `tp-latex` vs plain markdown download — start with markdown, add PDF if owner requests.

