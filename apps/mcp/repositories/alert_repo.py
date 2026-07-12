from __future__ import annotations

import httpx

from mcp_server.config import config
from mcp_server.schemas.operations import AlertDispatchResult


class AlertRepository:
    """Calls the Dashboard API to dispatch alerts. Not a DB repo — wraps HTTP."""

    async def dispatch(self) -> AlertDispatchResult:
        headers = {}
        if config.DASHBOARD_API_SECRET:
            headers["Authorization"] = f"Bearer {config.DASHBOARD_API_SECRET}"

        async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT) as client:
            try:
                resp = await client.post(
                    f"{config.DASHBOARD_API_URL}/api/admin/alerts/dispatch-internal",
                    headers=headers,
                )
                resp.raise_for_status()
                data = resp.json()
                return AlertDispatchResult(
                    status="success",
                    alerts_sent=data.get("alerts_sent", 0),
                    message=data.get("message", "Alert dispatch completed"),
                )
            except httpx.HTTPError as e:
                return AlertDispatchResult(
                    status="error",
                    message=f"Failed to dispatch alerts: {e}",
                )
