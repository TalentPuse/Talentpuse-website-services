"""MCP Client — connect to MCP server, call tools."""

import logging

from fastmcp import Client

from app.services.agent.config import cfg

logger = logging.getLogger(__name__)


async def call_mcp_tool(name: str, arguments: dict) -> str:
    try:
        async with Client(cfg["mcp"]["server_url"]) as client:
            result = await client.call_tool(name, arguments)
            items = result.content if hasattr(result, "content") else result
            if items:
                return "\n".join(
                    c.text if hasattr(c, "text") else str(c) for c in items
                )
            return ""
    except Exception as e:
        logger.warning("MCP tool '%s' failed: %s", name, e)
        return f"Loi: Khong the ket noi den MCP server de goi tool '{name}'. Vui long thu lai sau hoac hoi khac."
