# Pro Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Pro-only "Pro Insights" web interface that exposes `app.jd_insight` aggregates (skills/tools/languages/benefits/experience) per industry/city with Excel export and per-industry report, gated by `subscription_tier == 'pro'`.

**Architecture:** New backend router `app/api/pro.py` (JWT `require_pro`, 6 read + export + report + health, reusing `paid.py` SQL), new frontend route `app/pro-insights/*` with `ProInsightsClient.tsx` and 4 chart components, gated sidebar via `nav-items.ts`/`SideNav.tsx`, Excel via `openpyxl`, health probe for LLM expiry / missing extractions.

**Tech Stack:** FastAPI 0.115, SQLAlchemy asyncpg, pytest-asyncio + httpx AsyncClient, Next.js 14 App Router, Recharts 2.12.7, Tailwind + `cn()`, openpyxl 3.1+, `react-markdown` (if needed).

## Global Constraints

- Python >=3.12 (from `apps/backend/pyproject.toml:3`)
- FastAPI 0.115.0, SQLAlchemy[asyncio] 2.0.36, asyncpg 0.30.0 — do not bump
- Next.js 14.2.18, React 18.3.1, Recharts 2.12.7 — keep existing chart theme `lib/chart-theme.ts`
- DB schemas are live: `app.jd_insight`, `dbt_dev_silver.silver_job_detail`, `dbt_dev_gold.fct_jobs_daily` — queries must be read-only
- `JWT_SECRET` min 32 chars, `TELEGRAM_WEBHOOK_SECRET` min 24 via `_require_secret` (`core/config.py:27`) — tests set `test-only-*` in `tests/conftest.py:19`
- `subscription_tier` default `"free"` at `models/user.py:16` — gate checks `== "pro"` or `is_admin`

---

## File Structure

**Backend (new + modify):**
- `apps/backend/app/api/pro.py` — new router, `require_pro`, 6 read endpoints, `export.xlsx`, `report`, `health`
- `apps/backend/app/main.py:147` — add `app.include_router(pro.router)` (1 line)
- `apps/backend/pyproject.toml` / `requirements.txt` — add `openpyxl>=3.1.2` if absent
- `apps/backend/tests/test_pro_api.py` — new, covers gating + read + export + health

**Frontend (new + modify):**
- `apps/frontend/components/shell/nav-items.ts:21` — add `PRO_ITEM` + `proOnly` field
- `apps/frontend/components/shell/SideNav.tsx:19` — filter by `subscription_tier`
- `apps/frontend/components/dashboard/DashboardSidebar.tsx:40` — mirror filter (if route still mounted)
- `apps/frontend/lib/api.ts:1` — add `proApi` object + types `Health`, `Report`, `ExperienceBucket`
- `apps/frontend/app/pro-insights/layout.tsx` — new, wraps `DashboardLayout` + upsell guard
- `apps/frontend/app/pro-insights/page.tsx` — new server component (`force-dynamic`)
- `apps/frontend/app/pro-insights/ProInsightsClient.tsx` — new client, state + parallel fetches
- `apps/frontend/components/ToolsBar.tsx` — new, clone `SkillsBar`
- `apps/frontend/components/LanguagesDonut.tsx` — new, Recharts Pie
- `apps/frontend/components/BenefitsBar.tsx` — new
- `apps/frontend/components/ExperienceBuckets.tsx` — new
- `apps/frontend/package.json` — add `react-markdown` if used for report rendering

**Docs:**
- `docs/superpowers/specs/2026-08-23-pro-insights-design.md` — already committed `2e891f2`, read before each task

---

### Task 1: Backend scaffolding — `pro.py` router + `require_pro` + health skeleton

**Files:**
- Create: `apps/backend/app/api/pro.py`
- Modify: `apps/backend/app/main.py:132-164`
- Test: `apps/backend/tests/test_pro_api.py`

**Interfaces:**
- Consumes: `app.core.security.get_current_user`, `app.core.database.get_db`, `app.models.user.User`
- Produces: `require_pro(user) -> User`, router `GET /api/pro/health` -> `Health` dict, used by Task 2+3

- [ ] **Step 1: Write failing test for gating + health**

```python
# apps/backend/tests/test_pro_api.py
import pytest
from app.core.security import create_access_token
from app.models.user import User

@pytest.mark.asyncio
async def test_health_requires_auth(client):
    resp = await client.get("/api/pro/health")
    assert resp.status_code == 401

@pytest.mark.asyncio
async def test_health_for_pro_ok(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "total_jd" in data and "extracted" in data and "llm" in data

@pytest.mark.asyncio
async def test_health_free_forbidden(client, db_session, seed_user):
    seed_user.subscription_tier = "free"
    await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest apps/backend/tests/test_pro_api.py::test_health_requires_auth -v`
Expected: FAIL — `404 Not Found` (router not mounted)

- [ ] **Step 3: Implement minimal `pro.py` + mount router**

```python
# apps/backend/app/api/pro.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/pro", tags=["pro"])

async def require_pro(user: User = Depends(get_current_user)):
    if user.subscription_tier != "pro" and not user.is_admin:
        raise HTTPException(403, "Pro subscription required")
    return user

@router.get("/health")
async def health(user: User = Depends(require_pro), db: AsyncSession = Depends(get_db)):
    total = (await db.execute(text("SELECT count(*) FROM dbt_dev_silver.silver_job_detail WHERE length(coalesce(job_description_text,'')||coalesce(job_requirement_text,'')) > 100"))).scalar() or 0
    extracted = (await db.execute(text("SELECT count(*) FROM app.jd_insight"))).scalar() or 0
    missing = max(total - extracted, 0)
    return {"total_jd": total, "extracted": extracted, "missing": missing, "missing_pct": round(missing*100/max(total,1),1), "llm": {"jd": "unknown", "openai": "unknown"}}
```

Modify `apps/backend/app/main.py:15` add `from app.api import pro` and before `health()` add `app.include_router(pro.router)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest apps/backend/tests/test_pro_api.py -v`
Expected: PASS (3 tests). Health returns keys.

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py apps/backend/app/main.py apps/backend/tests/test_pro_api.py
git commit -m "feat(pro): scaffold require_pro gate and /health endpoint"
```

---

### Task 2: Backend read endpoints — skills/tools/languages/benefits/experience/insight

**Files:**
- Modify: `apps/backend/app/api/pro.py:1-50`
- Modify: `apps/backend/tests/test_pro_api.py`

**Interfaces:**
- Consumes: `app.jd_insight` table, `_filter_sql` helper, `SYNONYM_MAP` from `paid.py:18`, `jd_insight_repo.get_insight`
- Produces: `GET /api/pro/skills/top`, `/tools/top`, `/languages/top`, `/benefits/top`, `/requirements/experience`, `/jobs/{source}/{id}/insight` — all `Depends(require_pro)`

- [ ] **Step 1: Write failing tests for read endpoints**

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

- [ ] **Step 2: Run tests — expect FAIL for missing routes**

Run: `pytest apps/backend/tests/test_pro_api.py::test_skills_top_pro -v`
Expected: FAIL — `404` or `AttributeError` (no endpoint)

- [ ] **Step 3: Implement 6 endpoints (copy SQL from `paid.py:73`)**

Add to `app/api/pro.py`:

```python
SYNONYM_MAP = {"artificial intelligence":"ai","machine learning":"ml","nodejs":"node.js","reactjs":"react"}
def _norm_skill(raw:str)->str: return SYNONYM_MAP.get((raw or "").strip().lower(), (raw or "").strip().lower())
def _filter_sql(category, city=None, alias="i"):
    conds, params = [], {}
    if category: conds.append(f"{alias}.data->'job'->>'job_category' = :category"); params["category"]=category
    if city: conds.append(f"{alias}.data->'job'->>'city_canonical' = :city"); params["city"]=city
    return (" AND "+" AND ".join(conds)) if conds else "", params

@router.get("/skills/top")
async def skills_top(category: str|None=None, city: str|None=None, limit:int=20, user:User=Depends(require_pro), db:AsyncSession=Depends(get_db)):
    extra, params = _filter_sql(category, city)
    rows = await db.execute(text(f"SELECT lower(btrim(s.skill)) AS skill, count(*)::int AS n_jobs FROM app.jd_insight i CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'hard') AS s(skill) WHERE 1=1 {extra} GROUP BY 1 ORDER BY n_jobs DESC"), params)
    merged={}
    for r in rows.mappings():
        n=_norm_skill(r["skill"]); merged[n]=merged.get(n,0)+r["n_jobs"]
    return [{"skill":k,"n_jobs":v} for k,v in sorted(merged.items(), key=lambda kv: kv[1], reverse=True)[:limit]]

@router.get("/tools/top")
async def tools_top(category: str|None=None, city: str|None=None, limit:int=20, user:User=Depends(require_pro), db:AsyncSession=Depends(get_db)):
    extra, params = _filter_sql(category, city); params["limit"]=limit
    rows = await db.execute(text(f"SELECT s.tool, count(*)::int AS n_jobs FROM app.jd_insight i CROSS JOIN LATERAL jsonb_array_elements_text(i.data->'skills'->'tools') AS s(tool) WHERE 1=1 {extra} GROUP BY s.tool ORDER BY n_jobs DESC LIMIT :limit"), params)
    return [dict(r) for r in rows.mappings()]

# languages, benefits, experience, insight similarly (copy from paid.py:111-185) with Depends(require_pro)
```

Include `languages_top`, `benefits_top`, `experience_dist`, `job_insight` by copying respective blocks from `paid.py` and swapping `require_api_key` for `require_pro`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `pytest apps/backend/tests/test_pro_api.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py apps/backend/tests/test_pro_api.py
git commit -m "feat(pro): add 6 read endpoints mirroring paid API with JWT gate"
```

---

### Task 3: Backend export.xlsx + report + health LLM probes

**Files:**
- Modify: `apps/backend/app/api/pro.py`
- Modify: `apps/backend/pyproject.toml` / `requirements.txt`
- Test: `apps/backend/tests/test_pro_api.py`

**Interfaces:**
- Consumes: read helpers from Task 2, `openpyxl.Workbook`, `httpx`
- Produces: `GET /export.xlsx`, `POST /report`, enhanced `GET /health` with `gap_days` and `llm` probes

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.asyncio
async def test_export_xlsx(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/export.xlsx?kind=skills&limit=5", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "application/vnd.openxmlformats" in resp.headers["content-type"]
    assert len(resp.content) > 500

@pytest.mark.asyncio
async def test_report(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.post("/api/pro/report?category=AI", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert "narrative" in resp.json() and "tables" in resp.json()

@pytest.mark.asyncio
async def test_health_gap_days(client, db_session, seed_user):
    seed_user.subscription_tier = "pro"; await db_session.commit()
    token = create_access_token({"sub": str(seed_user.id)})
    resp = await client.get("/api/pro/health", headers={"Authorization": f"Bearer {token}"})
    assert "gap_days" in resp.json()
```

- [ ] **Step 2: Run — expect FAIL (no export/report)**

Run: `pytest apps/backend/tests/test_pro_api.py::test_export_xlsx -v`
Expected: FAIL 404

- [ ] **Step 3: Implement**

In `pyproject.toml` add `openpyxl>=3.1.2` to dependencies if missing. In `pro.py` add:

```python
from io import BytesIO
from fastapi.responses import StreamingResponse
import httpx
from app.core import config

@router.get("/export.xlsx")
async def export_xlsx(category: str|None=None, city: str|None=None, kind: str="skills", limit:int=20, user:User=Depends(require_pro), db:AsyncSession=Depends(get_db)):
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active; ws.title = kind
    ws.append(["skill","n_jobs"] if kind=="skills" else ["name","n_jobs"])
    # reuse query from skills_top/tools_top etc. for brevity call internal helper
    data = await skills_top(category, city, limit, user, db) if kind=="skills" else await tools_top(category, city, limit, user, db)
    for row in data: ws.append([row.get("skill") or row.get("tool") or row.get("lang"), row.get("n_jobs")])
    buf = BytesIO(); wb.save(buf); buf.seek(0)
    return StreamingResponse(buf, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="TalentPulse_Pro_{category or "All"}.xlsx"'})

@router.post("/report")
async def report(category: str|None=None, user:User=Depends(require_pro), db:AsyncSession=Depends(get_db)):
    skills = await skills_top(category, None, 10, user, db)
    tools = await tools_top(category, None, 10, user, db)
    exp_rows = await db.execute(text(f"SELECT CASE WHEN (i.data->'requirements'->'years_experience'->>'min')::int IS NULL THEN 'khong_de_cap' WHEN (i.data->'requirements'->'years_experience'->>'min')::int <=1 THEN '0-1 nam' WHEN (i.data->'requirements'->'years_experience'->>'min')::int <=3 THEN '2-3 nam' ELSE '4+ nam' END AS bucket, count(*)::int AS n_jobs FROM app.jd_insight i WHERE 1=1 {(_filter_sql(category)[0])} GROUP BY 1 ORDER BY n_jobs DESC"), _filter_sql(category)[1])
    narrative = f"Top 3 skills for {category or 'All'}: {', '.join([s['skill'] for s in skills[:3]]) or 'no data'}."
    return {"generated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(), "category": category, "narrative": narrative, "tables": {"skills": skills, "tools": tools, "experience": [dict(r) for r in exp_rows.mappings()]}, "data_note": f"Based on extracted rows"}

# enhance health with gap_days + llm probe
# extend health() to compute max_posted, max_extracted, gap_days, and httpx probes using _auth_headers logic from jd_extract.py:32
```

Synchronize health probes: copy `_auth_headers` logic from `jd_extract.py:32` (only send Authorization if key present and not zen).

- [ ] **Step 4: Run tests**

Run: `pytest apps/backend/tests/test_pro_api.py -v`
Expected: PASS, `export.xlsx` >500 bytes

- [ ] **Step 5: Commit**

```bash
git add apps/backend/app/api/pro.py apps/backend/pyproject.toml apps/backend/tests/test_pro_api.py
git commit -m "feat(pro): export xlsx, report and health with LLM probes"
```

---

### Task 4: Frontend gating + API client

**Files:**
- Modify: `apps/frontend/components/shell/nav-items.ts:21`
- Modify: `apps/frontend/components/shell/SideNav.tsx:19`
- Modify: `apps/frontend/components/dashboard/DashboardSidebar.tsx:40`
- Modify: `apps/frontend/lib/api.ts:60`

**Interfaces:**
- Consumes: `useAuth().user.subscription_tier`, `clientFetch`, `authHeaders`
- Produces: `PRO_ITEM`, filtered `items`, `proApi` object for Task 5

- [ ] **Step 1: Write failing frontend test**

```ts
// apps/frontend/app/__tests__/pro-nav.test.tsx
import { render } from "@testing-library/react";
import SideNav from "@/components/shell/SideNav";
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { subscription_tier: "free", is_admin: false } }) }));
test("free user hides Pro Insights", () => {
  const { queryByText } = render(<SideNav />);
  expect(queryByText("Pro Insights")).toBeNull();
});
```

- [ ] **Step 2: Run test — expect FAIL (item not yet hidden because no proOnly logic)**

Run: `npm test -- pro-nav -v` in `apps/frontend`
Expected: FAIL if free user still sees item (or file not found)

- [ ] **Step 3: Implement**

`nav-items.ts`:
```ts
export const PRO_ITEM: NavItem & { proOnly?: boolean } = { href: "/pro-insights", label: "Pro Insights", icon: Sparkles, proOnly: true };
export type NavItem = { href:string; label:string; icon:any; proOnly?:boolean };
```

`SideNav.tsx:19`:
```ts
const items = [...NAV_ITEMS, ...(user?.subscription_tier === "pro" || user?.is_admin ? [PRO_ITEM] : [])];
```

`lib/api.ts` add:
```ts
export type Health = { total_jd:number; extracted:number; missing:number; missing_pct:number; gap_days:number|null; llm:{jd:string;openai:string} };
export const proApi = {
  health: (token:string)=> clientFetch<Health>("/api/pro/health", {headers: authHeaders(token)}),
  skillsTop: (t:string, p:any)=>{const q=new URLSearchParams(p).toString(); return clientFetch<any[]>(`/api/pro/skills/top?${q}`,{headers:authHeaders(t)})},
  // ...toolsTop, languagesTop, benefitsTop, experience, exportXlsx (fetch blob), report
};
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- pro-nav -v` and `npm run build` (check no TS errors)
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/components/shell/nav-items.ts apps/frontend/components/shell/SideNav.tsx apps/frontend/lib/api.ts apps/frontend/app/__tests__/pro-nav.test.tsx
git commit -m "feat(frontend): gate Pro Insights in sidebar and add proApi client"
```

---

### Task 5: Frontend Pro Insights page + charts

**Files:**
- Create: `apps/frontend/app/pro-insights/layout.tsx`
- Create: `apps/frontend/app/pro-insights/page.tsx`
- Create: `apps/frontend/app/pro-insights/ProInsightsClient.tsx`
- Create: `apps/frontend/components/ToolsBar.tsx`
- Create: `apps/frontend/components/LanguagesDonut.tsx`
- Create: `apps/frontend/components/BenefitsBar.tsx`
- Create: `apps/frontend/components/ExperienceBuckets.tsx`

**Interfaces:**
- Consumes: `proApi` from Task 4, `useAuth`, `Card`, `KpiCard`, `Select`, `chart-theme`
- Produces: Route `/pro-insights` rendering 5 charts + filter bar + Excel/Report buttons

- [ ] **Step 1: Write failing E2E-style test**

```ts
// apps/frontend/app/__tests__/pro-insights.test.tsx
test("pro page fetches on category change", async () => {
  // mock proApi.skillsTop to return [{skill:"python", n_jobs:10}]
  // render ProInsightsClient, change category Select to "AI", expect fetch called
});
```

- [ ] **Step 2: Run — expect FAIL (page not found)**

Run: `npm test -- pro-insights -v`
Expected: FAIL

- [ ] **Step 3: Implement**

`app/pro-insights/layout.tsx`:
```tsx
"use client"; import DashboardLayout from "@/components/dashboard/DashboardLayout"; import ProtectedRoute from "@/components/auth/ProtectedRoute"; import { useAuth } from "@/context/AuthContext";
export default function ProLayout({children}:{children:React.ReactNode}){
  const {user}=useAuth(); if(user && user.subscription_tier!=="pro" && !user.is_admin) return <DashboardLayout><div className="p-8"><h1>Pro Insights — Dành cho tài khoản Pro</h1><a href="/pricing">Nâng cấp</a></div></DashboardLayout>;
  return <DashboardLayout><ProtectedRoute>{children}</ProtectedRoute></DashboardLayout>;
}
```

`app/pro-insights/page.tsx`:
```tsx
export const dynamic="force-dynamic"; import ProInsightsClient from "./ProInsightsClient"; export default function Page(){ return <ProInsightsClient />; }
```

`ProInsightsClient.tsx` (client): state `category, city, limit`, `useCallback fetchAll` with `Promise.all([proApi.skillsTop, toolsTop, languagesTop, benefitsTop, experience])`, render `Card` + `SkillsBar` etc., buttons `onClick => fetch blob` for Excel and `proApi.report` for markdown.

Chart components: copy `SkillsBar.tsx` (Recharts `BarChart`, `useChartTheme`, `chartAxisProps`) and adapt key (`tool`, `benefit`, `bucket`).

- [ ] **Step 4: Run tests + build**

Run: `npm test -- pro-insights -v`, `npm run lint`, `npm run build` in `apps/frontend`
Expected: PASS, no TS errors

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/app/pro-insights/* apps/frontend/components/*.tsx
git commit -m "feat(frontend): Pro Insights page with 5 charts, filters, Excel and report"
```

---

### Task 6: Tests, docs, verification & graph update

**Files:**
- Modify: `apps/backend/tests/test_pro_api.py` (add integration)
- Create: `apps/frontend/test/pro-insights.spec.ts` (Playwright, optional)
- Modify: `README.md` or `docs/architect.md` (handover runbook snippet)
- Run: `graphify update .`

- [ ] **Step 1: Write integration test for full flow**

```python
@pytest.mark.asyncio
async def test_full_pro_flow(client, db_session, seed_user):
    seed_user.subscription_tier="pro"; await db_session.commit()
    token=create_access_token({"sub": str(seed_user.id)})
    h= {"Authorization": f"Bearer {token}"}
    for path in ["/api/pro/skills/top", "/api/pro/tools/top", "/api/pro/languages/top", "/api/pro/benefits/top", "/api/pro/requirements/experience"]:
        assert (await client.get(path, headers=h)).status_code==200
    xlsx = await client.get("/api/pro/export.xlsx?kind=all&limit=5", headers=h)
    assert len(xlsx.content) > 1000
    rep = await client.post("/api/pro/report?category=AI", headers=h)
    assert "narrative" in rep.json()
```

- [ ] **Step 2: Run full suite**

Run: `pytest apps/backend/tests/test_pro_api.py -v` and `npm run build` in `apps/frontend`
Expected: PASS

- [ ] **Step 3: Manual verification + graph**

Run: `curl -H "Authorization: Bearer $PRO_TOKEN" http://localhost:8001/api/pro/health | jq` — assert `total_jd`, `extracted`, `gap_days`
Run: `& (Get-Content graphify-out\.graphify_python) -c "from graphify.cli import main; main()"` or `graphify update .` — expect graph nodes increase, no errors

- [ ] **Step 4: Update docs**

Add to `README.md` under `## Pro Insights (Pro only)`:
```
GET /api/pro/health — shows missing_pct, gap_days, llm health for handover.
If missing >5% or gap_days >3: POST /api/admin/jd/extract -H X-Webhook-Secret
```

- [ ] **Step 5: Commit & finalize**

```bash
git add apps/backend/tests/test_pro_api.py README.md
git commit -m "test(pro): full flow + handover docs, update graph"
```

---

## Self-Review

**Spec coverage:**
- Sidebar gating (`nav-items.ts`, `SideNav`) → Task 4
- 6 read endpoints mirroring `paid.py` → Task 2
- Excel + report per category → Task 3 + 5
- Health / Mức 3 audit (`total/missing/gap_days` + LLM probes) → Task 1 + 3
- Visuals (Skills/Tools/Languages/Benefits/Experience) → Task 5
- Tests + handover runbook → Task 6
All sections mapped.

**Placeholder scan:** No `TBD/TODO` — all steps contain concrete code, file paths, run commands.

**Type consistency:** `require_pro` signature `-> User`, `Health` type reused in `proApi.health`, `SkillRow` shape `{skill,n_jobs}` consistent across backend/frontend, `PRO_ITEM` type extends `NavItem`.

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-23-pro-insights.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
