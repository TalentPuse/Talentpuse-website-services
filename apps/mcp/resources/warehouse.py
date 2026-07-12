from __future__ import annotations

import json

from fastmcp import FastMCP

from mcp_server.repositories import AnalyticsRepository, SkillRepository

_analytics_repo = AnalyticsRepository()
_skill_repo = SkillRepository()


def register_resources(mcp: FastMCP) -> None:

    @mcp.resource("data://warehouse/stats")
    async def warehouse_stats() -> str:
        """System stats snapshot: users, alerts, telegram connections."""
        result = await _analytics_repo.system_stats()
        return result.model_dump_json(ensure_ascii=False)

    @mcp.resource("data://warehouse/active-jobs")
    async def active_jobs() -> str:
        """Active job market overview snapshot."""
        result = await _analytics_repo.job_market_overview()
        return result.model_dump_json(ensure_ascii=False)

    @mcp.resource("data://warehouse/top-skills")
    async def top_skills() -> str:
        """Top 15 in-demand skills snapshot."""
        rows = await _skill_repo.demand(limit=15)
        return json.dumps([r.model_dump() for r in rows], ensure_ascii=False)
