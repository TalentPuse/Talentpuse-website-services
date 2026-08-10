# Dashboard Salary Removal + Demand/Geography Charts

Date: 2026-08-11
Status: Approved (Approach A)
Stakeholder: project owner (Vietnamese-language product)

## Problem

The public dashboard at `/dashboard` (Next.js `apps/frontend/app/dashboard/`) shows
salary-centric market stats that the owner wants gone: "bỏ vụ lương ra, vẽ thêm vài
cái chart khác" (remove the salary stuff, add some other charts). Salary currently
drives:

- Two KPI cards: "Công khai lương" (`pct_with_salary`) and "Lương trung bình"
  (`avg_salary_million`).
- The "Top 10 kỹ năng lương cao nhất" card (`HighestPayingSkills`).
- The "Mức lương theo Level x Thành phố" card (`SalaryByLevel`, P25/Median/P75).
- The "Avg salary" column in the "Top 20 công ty" table.

End-to-end removal is desired: backend endpoints AND frontend code, not just hiding
the UI (owner confirmed "Delete endpoints + code").

## Goal

Public `/dashboard` shows only salary-free, demand/geography market stats. All of it
stays public (no auth), category-filterable, and consistent with the existing
design system (recharts + `lib/chart-theme.ts` tokens).

## Scope

IN (Approach A — demand & geography):
- New public endpoints `/api/dashboard/cities` and `/api/dashboard/levels`.
- New charts "Việc làm theo Thành phố" and "Việc làm theo Cấp bậc".
- Remove all salary code (backend routes, schemas, frontend types/components/columns).
- Rebuild KPI row + section layout in `DashboardClient.tsx`.
- Update `apps/frontend/README.md` and `apps/backend/README.md` endpoint tables.

OUT (unchanged / internal only):
- Salary usage inside `apps/mcp` (its own DB queries) and
  `apps/backend/app/services/recommendations.py` — internal features, not the public
  dashboard. Owner asked to de-salary the dashboard, not all product features.
- `mart_salary_by_level` / salary columns in `fct_jobs_daily` — data side untouched.
- Admin analytics (`/api/admin/analytics`) — unrelated to this page.

## Current Architecture

Public dashboard data flow:

- `page.tsx` (server) → `api` (SSR fetch, `lib/api.ts`) → DashboardClient
  - `overview`, `topSkills`, `paying`, `salary`, `companies`, `categories`
- Category change → `DashboardClient.fetchData` → `dashboardApi`
  (browser fetch, `lib/api.ts`)
- Charts are recharts wrappers in `apps/frontend/components/` themed via
  `useChartTheme()` (CSS custom properties `--chart-1..6`, `--border`, ...).

Backend public endpoints (`apps/backend/app/api/`):
- `overview.py` — `/api/overview`, `/api/dashboard/categories`
- `skills.py` — `/api/skills/top`, `/api/skills/highest-paying` (REMOVE last)
- `salary.py` — `/api/salary/by-level` (REMOVE whole file)
- `companies.py` — `/api/companies/top` (REMOVE salary column)
- Schemas in `app/schemas/dashboard.py`.

## Design

### Backend

1. `overview.py` — add two routes (same router, prefix `/api`), each accepting the
   existing `category` query param and returning rows shaped like `SkillRow`
   (`{name: string, n_jobs: int, pct_of_jobs: float}`):

   - `GET /api/dashboard/cities` — group `dbt_dev_gold.fct_jobs_daily` by
     `city_canonical` (`is_active`, optional `job_category = :category`),
     order `n_jobs desc`, limit 15.
   - `GET /api/dashboard/levels` — group by `job_level`, same pattern, limit 15.

   Pattern mirrors `skills.py:top_skills` (mart path when no category, direct
   `fct_jobs_daily` + `count(distinct (source, source_job_id))` when filtered).

2. `skills.py` — delete the `highest-paying` route. Keep `/top`.
3. Delete `salary.py`; remove its router import/include in `main.py`.
4. `companies.py` — drop `avg_salary_million` from both SQL branches and from
   ordered columns. Keep `n_jobs desc, avg_views desc nulls last`.
5. `schemas/dashboard.py`:
   - Remove `HighestPayingSkillRow`, `SalaryByLevelRow`.
   - Remove `pct_with_salary` and `avg_salary_million` from `Overview`
     (only `Overview` schema used by `/api/overview` — only dashboard consumes it;
     MCP reads the DB directly, NOT this endpoint).
   - Remove `avg_salary_million` from `CompanyRow`.
   - Add `DashboardRow` (or reuse `SkillRow` shape) — decide whether a single
     shared row type suffices for cities/levels; prefer reuse.

### Frontend

`apps/frontend/lib/api.ts`:
- Delete types `HighestPayingSkillRow`, `SalaryByLevelRow`.
- `Overview` → `{ total_jobs: number }`; `CompanyRow` drops `avg_salary_million`.
- Delete `highestPayingSkills` + `salaryByLevel` from both `api` and `dashboardApi`.
- Add `dashboardCity`/`dashboardLevel` fetchers → `/api/dashboard/cities` and
  `/api/dashboard/levels` (both server `api` and client `dashboardApi`).

Components (`apps/frontend/components/`):
- Delete `HighestPayingSkills.tsx`, `SalaryByLevel.tsx`.
- Add `CitiesBar.tsx` — vertical-bar recharts layout modeled on `SkillsBar`
  (horizontal bars actually: YAxis category = city, XAxis number = jobs). Uses
  `chartAxisProps`/`useChartTheme`, tooltip shows jobs + `%`.
- Add `LevelsBar.tsx` — horizontal bars, YAxis category = job level; same theming.
- `CompaniesTable.tsx` — remove the "Avg salary" `<TableHead>` + `<TableCell>`.

`app/dashboard/page.tsx` — stop fetching `paying`/`salary`; fetch cities/levels.

`app/dashboard/DashboardClient.tsx`:

- Props: replace `paying: HighestPayingSkillRow[]` + `salary` with
  `cities: DashboardCityRow[]` + `levels: DashboardLevelRow[]`.
- KPI row (3 cards):
  - "Việc làm đang tuyển" — `overview.total_jobs`, sparkline = topSkills n_jobs
    (unchanged).
  - "Ngành nghề theo dõi" — `categories.length`, sparkline from categories? No
    series (categories has no count). Use a plain StatCard, no sparkline.
  - "Số công ty tuyển dụng" — `companies.length`, sparkline = companies n_jobs.
- Section layout:
  - Row 1 (2-col): "Top 15 kỹ năng được yêu cầu" (SkillsBar, keep) +
    "Việc làm theo Thành phố" (CitiesBar).
  - Row 2 (full-width): "Việc làm theo Cấp bậc kinh nghiệm" (LevelsBar).
  - Row 3 (full-width): "Top 20 công ty tuyển dụng" (CompaniesTable,
    salary column gone).
- Empty states: cities/levels are `[]` when a filter matches nothing — charts render
  empty; match existing fallback pattern (SkillsBar renders empty grid).

### Error handling

No new failure modes: `dashboardApi` already falls back to `[]`/empty on fetch
error; `api` (SSR) falls back identically. New endpoints reuse the exact query +
coalesce patterns of existing endpoints, so empty-filter categories yield `[]`, not
500 (mirrors the guard documented in `overview.py`).

### Testing

- Backend: no existing tests for `/api/skills/top`-style endpoints were found; the
  new endpoints follow the same query shape. Add none unless a test harness for
  public endpoints exists — check `apps/backend/tests/` during implementation.
- Frontend: run `npm run lint`/`tsc` in `apps/frontend`; confirm no dangling
  references to deleted types/components.
- Runtime verification: `docker compose` backend up; curl the two new endpoints
  with/without a category; curl `/dashboard` HTML and grep that "salary" is gone.

## Files Touched

Backend:
- `apps/backend/app/api/overview.py` (+2 routes)
- `apps/backend/app/api/skills.py` (remove highest-paying)
- `apps/backend/app/api/salary.py` (delete)
- `apps/backend/app/api/companies.py` (drop salary col)
- `apps/backend/app/schemas/dashboard.py`
- `apps/backend/app/main.py` (drop salary router)
- `apps/backend/README.md` (endpoint table)

Frontend:
- `apps/frontend/lib/api.ts`
- `apps/frontend/app/dashboard/page.tsx`
- `apps/frontend/app/dashboard/DashboardClient.tsx`
- `apps/frontend/components/CitiesBar.tsx` (new)
- `apps/frontend/components/LevelsBar.tsx` (new)
- `apps/frontend/components/CompaniesTable.tsx`
- `apps/frontend/components/HighestPayingSkills.tsx` (delete)
- `apps/frontend/components/SalaryByLevel.tsx` (delete)
- `apps/frontend/README.md` (endpoint/chart table)

## Open Questions for Implementation

- Reuse `SkillRow` for cities/levels rows vs. new `CityRow`/`LevelRow` types
  (naming for readability). Resolve during implementation — semantics are identical.
- Whether `apps/backend/tests/` has a pattern worth extending; default to no new
  tests if none exists.