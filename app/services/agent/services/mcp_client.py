"""MCP Client — connect to MCP server, call tools."""

from fastmcp import Client

from app.services.agent.config import cfg


async def call_mcp_tool(name: str, arguments: dict) -> str:
    async with Client(cfg["mcp"]["server_url"]) as client:
        result = await client.call_tool(name, arguments)
        if result.content:
            return "\n".join(c.text for c in result.content if hasattr(c, "text"))
        return str(result.data) if result.data else ""
