# Plan: TalentPulse MCP Server

## Context

Build standalone MCP server dùng **FastMCP** để expose warehouse tools cho Hermes agent.
Hermes agent kết nối qua STDIO hoặc HTTP, có thể truy vấn data warehouse + trigger alert dispatch.

## Tools (9 tools)

### Nhóm 1: Skill Advisor (cho use case recommend skills theo CV)

| Tool | Mô tả |
|------|--------|
| `query_skill_gap` | Query top skills user CHƯA có, exclude existing skills |
| `get_user_profile` | Lấy profile user: skills, titles, level |

### Nhóm 2: Warehouse Analytics (cho use case giám sát data)

| Tool | Mô tả |
|------|--------|
| `get_system_stats` | Tổng users, active users, telegram linked, alerts today/week |
| `get_job_market_overview` | Active jobs, avg salary, job count by category/city |
| `get_top_skills` | Top in-demand skills, filter by category, limit |
| `get_salary_analysis` | Salary by level + city (P25/P50/P75) |
| `get_top_companies` | Top hiring companies |
| `get_skill_trends` | Skills đang trending up/down theo tuần |

### Nhóm 3: Operations (cho use case vận hành)

| Tool | Mô tả |
|------|--------|
| `run_alert_dispatch` | Trigger alert dispatch pipeline, trả về số alerts sent |

## Architecture

```
Hermes Agent
    │
    │  STDIO / HTTP
    ▼
┌─────────────────────────────────┐
│  TalentPulse MCP Server         │
│  (FastMCP)                      │
│                                 │
│  9 tools                        │
│  ┌───────────────────────────┐  │
│  │ query_skill_gap           │  │
│  │ get_user_profile          │  │
│  │ get_system_stats          │──┼──► PostgreSQL (warehouse)
│  │ get_job_market_overview   │  │
│  │ get_top_skills            │  │
│  │ get_salary_analysis       │  │
│  │ get_top_companies         │  │
│  │ get_skill_trends          │  │
│  │ run_alert_dispatch        │──┼──► Dashboard API (HTTP POST)
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Chú thích:** `run_alert_dispatch` gọi Dashboard API (`POST /api/admin/alerts/dispatch`) thay vì chạy logic trực tiếp, vì alert dispatch cần SQLAlchemy models + Telegram bot + JobMatcher — quá nặng để kéo vào MCP server. Gọi qua HTTP reuse sẵn logic.

## Skeleton thư mục

```
mcp_server/
├── __init__.py
├── server.py                 # FastMCP app + all tools
├── db.py                     # asyncpg connection pool
├── requirements.txt          # deps
├── .env.example              # env vars template
└── README.md                 # install + run instructions
```

Tổng cộng: **5 files mới** (server.py, db.py, requirements.txt, .env.example, README.md)

---

## Step 1 — `mcp_server/requirements.txt`

```
fastmcp>=2.0
asyncpg>=0.30
httpx>=0.27
python-dotenv>=1.0
```

## Step 2 — `mcp_server/.env.example`

```bash
# Database (same as dashboard backend)
DATABASE_URL=postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse

# Dashboard API (for run_alert_dispatch)
DASHBOARD_API_URL=http://localhost:8001
DASHBOARD_API_SECRET=your-admin-secret-here
```

## Step 3 — `mcp_server/db.py` — Connection pool

```python
import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=os.getenv("DATABASE_URL"),
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
```

## Step 4 — `mcp_server/server.py` — FastMCP app + 9 tools

```python
import json
import os
from typing import Annotated, Literal

import httpx
from fastmcp import FastMCP
from pydantic import Field

from mcp_server.db import get_pool, close_pool

mcp = FastMCP(
    "TalentPulse",
    instructions=(
        "TalentPulse MCP Server — Vietnam IT/AI job market analytics.\n"
        "Use get_system_stats or get_job_market_overview for general queries.\n"
        "Use query_skill_gap for skill recommendations based on user profile.\n"
        "Use run_alert_dispatch to trigger job alert pipeline."
    ),
)


# ─── Skill Advisor ─────────────────────────────────────


@mcp.tool(tags={"skill", "recommend"})
async def query_skill_gap(
    user_skills: Annotated[str, Field(
        description="Comma-separated list of skills the user already knows, e.g. 'python,sql,docker'"
    )],
    category: Annotated[str | None, Field(
        description="Filter by skill category: ai_ml, programming_languages, frameworks_libraries, cloud_platforms, databases, devops_tools, data_engineering, soft_skills"
    )] = None,
    limit: Annotated[int, Field(description="Max skills to return", ge=1, le=50)] = 20,
) -> str:
    """Query top in-demand skills that the user DOES NOT already have.
    Returns skill name, category, number of jobs requiring it, average salary."""
    pool = await get_pool()
    skills = [s.strip().lower() for s in user_skills.split(",") if s.strip()]

    cat_filter = "AND se.skill_category = $3" if category else ""
    args = [tuple(skills), limit]
    if category:
        args.insert(2, category)

    rows = await pool.fetch(f"""
        SELECT skill, skill_category, n_jobs,
               ROUND(avg_salary_m) AS avg_salary_m
        FROM dbt_dev_gold.mart_skill_demand_v2
        WHERE n_jobs >= 3
          AND skill NOT IN $1
          {cat_filter}
        ORDER BY n_jobs DESC
        LIMIT $2
    """, *args)

    if not rows:
        return "No skill gap data found."

    lines = ["Skill gap analysis (skills user chưa có):\n"]
    for r in rows:
        lines.append(
            f"- {r['skill']} ({r['skill_category']}): "
            f"{r['n_jobs']} jobs, avg {r['avg_salary_m'] or '?'}M VND"
        )
    return "\n".join(lines)


@mcp.tool(tags={"skill", "recommend"})
async def get_user_profile(
    user_id: Annotated[str, Field(description="User UUID")],
) -> str:
    """Get user profile: skills, desired job titles, experience level, preferred cities."""
    pool = await get_pool()
    row = await pool.fetchrow("""
        SELECT skills, desired_titles, experience_level,
               preferred_cities, desired_salary_min, desired_salary_max
        FROM app.users WHERE id = $1
    """, user_id)

    if not row:
        return f"User {user_id} not found."

    return json.dumps({
        "skills": row["skills"] or [],
        "desired_titles": row["desired_titles"] or [],
        "experience_level": row["experience_level"],
        "preferred_cities": row["preferred_cities"] or [],
        "desired_salary_range": (
            f"{row['desired_salary_min']}M - {row['desired_salary_max']}M VND"
            if row["desired_salary_min"] else None
        ),
    }, ensure_ascii=False)


# ─── Warehouse Analytics ────────────────────────────────


@mcp.tool(tags={"analytics", "readonly"})
async def get_system_stats() -> str:
    """Get TalentPulse system stats: total users, active users, telegram connections,
    alerts sent today/this week/total."""
    pool = await get_pool()
    row = await pool.fetchrow("""
        SELECT
            (SELECT count(*) FROM app.users)::int AS total_users,
            (SELECT count(*) FROM app.users WHERE is_active)::int AS active_users,
            (SELECT count(*) FROM app.telegram_connections WHERE status = 'active')::int AS telegram_linked,
            (SELECT count(*) FROM app.alert_logs
             WHERE sent_at >= CURRENT_DATE)::int AS alerts_today,
            (SELECT count(*) FROM app.alert_logs
             WHERE sent_at >= date_trunc('week', CURRENT_DATE))::int AS alerts_this_week,
            (SELECT count(*) FROM app.alert_logs)::int AS total_alerts
    """)
    return json.dumps(dict(row), ensure_ascii=False)


@mcp.tool(tags={"analytics", "readonly"})
async def get_job_market_overview(
    category: Annotated[str | None, Field(
        description="Filter by job category, e.g. 'AI Engineer', 'Data Engineer'"
    )] = None,
    city: Annotated[str | None, Field(
        description="Filter by city, e.g. 'Ho Chi Minh', 'Ha Noi'"
    )] = None,
) -> str:
    """Get job market overview: total active jobs, salary stats, breakdown by category and city."""
    pool = await get_pool()

    conditions = ["is_active = true"]
    params = []
    idx = 1

    if category:
        idx += 1
        conditions.append(f"job_category = ${idx}")
        params.append(category)
    if city:
        idx += 1
        conditions.append(f"city_canonical = ${idx}")
        params.append(city)

    where = " AND ".join(conditions)

    row = await pool.fetchrow(f"""
        SELECT
            count(*)::int AS total_active_jobs,
            ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
            ROUND(MIN(salary_vnd_monthly_min) / 1000000.0, 1) AS min_salary_m,
            ROUND(MAX(salary_vnd_monthly_max) / 1000000.0, 1) AS max_salary_m
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE {where}
    """, *params)

    # Top categories
    cat_rows = await pool.fetch(f"""
        SELECT job_category, count(*)::int AS n_jobs
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE {where}
        GROUP BY job_category
        ORDER BY n_jobs DESC
        LIMIT 10
    """, *params)

    # Top cities
    city_rows = await pool.fetch(f"""
        SELECT city_canonical, count(*)::int AS n_jobs
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE {where}
        GROUP BY city_canonical
        ORDER BY n_jobs DESC
        LIMIT 10
    """, *params)

    return json.dumps({
        "overview": dict(row),
        "top_categories": [dict(r) for r in cat_rows],
        "top_cities": [dict(r) for r in city_rows],
    }, ensure_ascii=False)


@mcp.tool(tags={"analytics", "readonly"})
async def get_top_skills(
    category: Annotated[str | None, Field(
        description="Filter by skill category: ai_ml, programming_languages, etc."
    )] = None,
    limit: Annotated[int, Field(description="Number of skills to return", ge=1, le=50)] = 15,
) -> str:
    """Get top in-demand skills across all jobs. Returns skill name, number of jobs, average salary."""
    pool = await get_pool()

    cat_filter = "AND skill_category = $2" if category else ""
    args = [limit] + ([category] if category else [])

    rows = await pool.fetch(f"""
        SELECT skill, skill_category, n_jobs,
               ROUND(pct_of_jobs, 2) AS pct_of_jobs,
               ROUND(avg_salary_m) AS avg_salary_m
        FROM dbt_dev_gold.mart_skill_demand_v2
        WHERE n_jobs >= 3
          {cat_filter}
        ORDER BY n_jobs DESC
        LIMIT $1
    """, *args)

    return json.dumps([dict(r) for r in rows], ensure_ascii=False)


@mcp.tool(tags={"analytics", "readonly"})
async def get_salary_analysis(
    job_level: Annotated[str | None, Field(
        description="Filter by level: intern, fresher, junior, mid, senior, lead, manager"
    )] = None,
    city: Annotated[str | None, Field(
        description="Filter by city"
    )] = None,
) -> str:
    """Get salary distribution by level and city. Returns P25, P50 (median), P75 salaries."""
    pool = await get_pool()

    conditions = ["salary_vnd_monthly_avg IS NOT NULL"]
    params = []
    idx = 0

    if job_level:
        idx += 1
        conditions.append(f"job_level = ${idx}")
        params.append(job_level)
    if city:
        idx += 1
        conditions.append(f"city_canonical = ${idx}")
        params.append(city)

    where = " AND ".join(conditions)

    rows = await pool.fetch(f"""
        SELECT
            job_level,
            city_canonical,
            count(*)::int AS n_jobs,
            ROUND((PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY salary_vnd_monthly_avg)) / 1000000.0, 1) AS p25_m,
            ROUND((PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY salary_vnd_monthly_avg)) / 1000000.0, 1) AS p50_m,
            ROUND((PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY salary_vnd_monthly_avg)) / 1000000.0, 1) AS p75_m
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE {where}
        GROUP BY job_level, city_canonical
        ORDER BY p50_m DESC
        LIMIT 30
    """, *params)

    return json.dumps([dict(r) for r in rows], ensure_ascii=False)


@mcp.tool(tags={"analytics", "readonly"})
async def get_top_companies(
    limit: Annotated[int, Field(description="Number of companies", ge=1, le=50)] = 15,
) -> str:
    """Get top hiring companies by active job count. Includes avg salary and primary city."""
    pool = await get_pool()

    rows = await pool.fetch("""
        SELECT
            company_name,
            count(*)::int AS active_jobs,
            ROUND(AVG(salary_vnd_monthly_avg) / 1000000.0, 1) AS avg_salary_m,
            mode() WITHIN GROUP (ORDER BY city_canonical) AS primary_city
        FROM dbt_dev_gold.fct_jobs_daily
        WHERE is_active
          AND company_name IS NOT NULL
        GROUP BY company_name
        ORDER BY active_jobs DESC
        LIMIT $1
    """, limit)

    return json.dumps([dict(r) for r in rows], ensure_ascii=False)


@mcp.tool(tags={"analytics", "readonly"})
async def get_skill_trends(
    weeks: Annotated[int, Field(description="Number of recent weeks to analyze", ge=1, le=12)] = 4,
    limit: Annotated[int, Field(description="Top N trending skills", ge=1, le=30)] = 15,
) -> str:
    """Get skill demand trends over recent weeks. Shows which skills are trending up or down."""
    pool = await get_pool()

    rows = await pool.fetch("""
        SELECT
            skill,
            skill_category,
            week,
            n_jobs_that_week,
            avg_salary_m
        FROM dbt_dev_gold.mart_skill_trend
        WHERE week >= CURRENT_DATE - ($1 || ' weeks')::interval
        ORDER BY skill, week
    """, weeks)

    if not rows:
        return "No trend data available."

    # Aggregate per skill
    from collections import defaultdict
    skill_data = defaultdict(lambda: {"weeks": [], "category": None})
    for r in rows:
        s = skill_data[r["skill"]]
        s["category"] = r["skill_category"]
        s["weeks"].append({
            "week": str(r["week"]),
            "n_jobs": r["n_jobs_that_week"],
            "avg_salary_m": float(r["avg_salary_m"]) if r["avg_salary_m"] else None,
        })

    # Calculate trend (latest week vs first week)
    results = []
    for skill, data in skill_data.items():
        if len(data["weeks"]) >= 2:
            first = data["weeks"][0]["n_jobs"]
            last = data["weeks"][-1]["n_jobs"]
            change_pct = round((last - first) / first * 100, 1) if first > 0 else 0
            results.append({
                "skill": skill,
                "category": data["category"],
                "trend_pct": change_pct,
                "latest_jobs": last,
                "latest_salary_m": data["weeks"][-1]["avg_salary_m"],
            })

    results.sort(key=lambda x: abs(x["trend_pct"]), reverse=True)
    return json.dumps(results[:limit], ensure_ascii=False)


# ─── Operations ─────────────────────────────────────────


@mcp.tool(tags={"operations", "write"})
async def run_alert_dispatch() -> str:
    """Trigger the job alert dispatch pipeline.
    Finds matching jobs for all active users and sends alerts via Telegram.
    Returns the number of alerts sent.

    WARNING: This sends real messages to users. Use with caution."""
    api_url = os.getenv("DASHBOARD_API_URL", "http://localhost:8001")
    api_secret = os.getenv("DASHBOARD_API_SECRET", "")

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            resp = await client.post(
                f"{api_url}/api/admin/alerts/dispatch",
                headers={"Authorization": f"Bearer {api_secret}"} if api_secret else {},
            )
            resp.raise_for_status()
            data = resp.json()
            return json.dumps({
                "status": "success",
                "alerts_sent": data.get("alerts_sent", 0),
                "message": data.get("message", "Alert dispatch completed"),
            }, ensure_ascii=False)
        except httpx.HTTPError as e:
            return json.dumps({
                "status": "error",
                "message": f"Failed to dispatch alerts: {e}",
            }, ensure_ascii=False)
```

## Step 5 — `mcp_server/__init__.py`

```python
# empty
```

## Step 6 — `mcp_server/README.md` — Run instructions

```markdown
# TalentPulse MCP Server

## Install

```bash
cd mcp_server
pip install -r requirements.txt
```

## Run (STDIO mode — for Claude Code / Claude Desktop / Cursor)

```bash
fastmcp run server.py
```

## Run (HTTP mode — for remote agents)

```bash
fastmcp run server.py --transport http --port 8080
```

## Install into Claude Code

```bash
fastmcp install claude-code server.py --env DATABASE_URL=postgresql://... --env DASHBOARD_API_URL=http://localhost:8001
```

## Install into Hermes agent (mcp.json)

Add to your agent's mcp.json:

```json
{
  "mcpServers": {
    "talentpulse": {
      "command": "uv",
      "args": ["run", "--with", "fastmcp", "fastmcp", "run", "/path/to/mcp_server/server.py"],
      "env": {
        "DATABASE_URL": "postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse",
        "DASHBOARD_API_URL": "http://localhost:8001",
        "DASHBOARD_API_SECRET": "your-secret"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `query_skill_gap` | Top skills user chưa có, filter by category |
| `get_user_profile` | Profile: skills, titles, level, cities, salary range |
| `get_system_stats` | Users, alerts, telegram connections |
| `get_job_market_overview` | Active jobs, salary, by category/city |
| `get_top_skills` | Top in-demand skills |
| `get_salary_analysis` | Salary P25/P50/P75 by level + city |
| `get_top_companies` | Top hiring companies |
| `get_skill_trends` | Skills trending up/down weekly |
| `run_alert_dispatch` | Trigger alert dispatch pipeline |
```

---

## Dashboard API cần thêm endpoint cho alert dispatch

Hiện tại `api/admin.py` cần thêm endpoint `POST /api/admin/alerts/dispatch` để MCP server gọi:

```python
# Trong app/api/admin.py, thêm:

@router.post("/alerts/dispatch")
async def dispatch_alerts_endpoint(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    count = await dispatch_alerts(db)
    return {"alerts_sent": count, "message": f"Dispatched {count} alerts"}
```

Nếu không muốn check admin auth cho internal call (MCP → API trên cùng server), có thể dùng secret header check đơn giản.

---

## Thứ tự implement

| # | Task | File | Effort |
|---|------|------|--------|
| 1 | Requirements | `mcp_server/requirements.txt` | 1 min |
| 2 | Env template | `mcp_server/.env.example` | 1 min |
| 3 | DB pool | `mcp_server/db.py` | 5 min |
| 4 | MCP server | `mcp_server/server.py` (9 tools) | 30 min |
| 5 | Init | `mcp_server/__init__.py` | 1 min |
| 6 | README | `mcp_server/README.md` | 5 min |
| 7 | Dashboard endpoint | `app/api/admin.py` (add dispatch) | 5 min |
| 8 | Test locally | `fastmcp dev server.py` | 10 min |

**Total: ~60 min**

## Usage example — Hermes agent

```
User: "Bao nhiêu user đang active trên hệ thống?"
Hermes: [calls get_system_stats]
        "Hiện có 42 active users, 28 telegram linked, 156 alerts sent hôm nay."

User: "User 123456 cần học thêm gì cho AI?"
Hermes: [calls get_user_profile → query_skill_gap]
        "User đã biết python, sql, docker. Top 5 skills cần bổ sung:
         1. pytorch (AI/ML) - 45 jobs, avg 28M VND
         2. langchain (frameworks) - 32 jobs, avg 35M VND
         ..."

User: "Chạy alert dispatch đi"
Hermes: [calls run_alert_dispatch]
        "Dispatched 23 alerts to 15 users."
```
