from __future__ import annotations

from contextlib import asynccontextmanager

from fastmcp import FastMCP
from starlette.responses import JSONResponse

from mcp_server.db import close_pool, get_pool


@asynccontextmanager
async def lifespan(app):
    await get_pool()
    yield
    await close_pool()


mcp = FastMCP(
    "TalentPulse",
    instructions=(
        "TalentPulse MCP Server — Vietnam IT/AI job market analytics.\n"
        "Use get_system_stats or get_job_market_overview for general queries.\n"
        "Use query_skill_gap for skill recommendations based on user profile.\n"
        "Use run_alert_dispatch to trigger job alert pipeline."
    ),
    lifespan=lifespan,
)


@mcp.custom_route("/health", methods=["GET"])
async def health(request):
    try:
        pool = await get_pool()
        await pool.fetchval("SELECT 1")
        return JSONResponse({"status": "healthy", "db": "ok"})
    except Exception as e:
        return JSONResponse({"status": "unhealthy", "db": str(e)}, status_code=503)


# ── Register tools ──────────────────────────────────────

from mcp_server.tools.skills import query_skill_gap, get_user_profile  # noqa: E402
from mcp_server.tools.analytics import (  # noqa: E402
    get_system_stats,
    get_job_market_overview,
    get_top_skills,
    get_salary_analysis,
    get_top_companies,
    get_skill_trends,
)
from mcp_server.tools.operations import run_alert_dispatch  # noqa: E402

mcp.add_tool(query_skill_gap)
mcp.add_tool(get_user_profile)
mcp.add_tool(get_system_stats)
mcp.add_tool(get_job_market_overview)
mcp.add_tool(get_top_skills)
mcp.add_tool(get_salary_analysis)
mcp.add_tool(get_top_companies)
mcp.add_tool(get_skill_trends)
mcp.add_tool(run_alert_dispatch)

# ── Register resources ─────────────────────────────────

from mcp_server.resources.warehouse import register_resources  # noqa: E402

register_resources(mcp)

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8080)
