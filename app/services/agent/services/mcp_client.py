"""MCP Client — connect to MCP server, call tools."""

from fastmcp import Client

from app.services.agent.config import cfg


async def call_mcp_tool(name: str, arguments: dict) -> str:
    async with Client(cfg["mcp"]["server_url"]) as client:
        result = await client.call_tool(name, arguments)
        # Handle both CallToolResult (.content) and plain list returns
        items = result.content if hasattr(result, "content") else result
        if items:
            return "\n".join(
                c.text if hasattr(c, "text") else str(c) for c in items
            )
        return ""
