from __future__ import annotations

from fastmcp.tools import tool
from tenacity import retry, stop_after_attempt, wait_exponential

from mcp_server.repositories import AlertRepository

_alert_repo = AlertRepository()


@tool(tags={"operations", "write"})
@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=2, max=15))
async def run_alert_dispatch() -> str:
    """Trigger the job alert dispatch pipeline.
    Finds matching jobs for all active users and sends alerts via Telegram.

    WARNING: This sends real messages to users. Use with caution."""
    result = await _alert_repo.dispatch()
    return result.model_dump_json(ensure_ascii=False)
