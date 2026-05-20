"""MCP Client — connect to MCP server, call tools."""

from fastmcp import Client

from app.services.agent.config import cfg


async def call_mcp_tool(name: str, arguments: dict) -> str:
    async with Client(cfg["mcp"]["server_url"]) as client:
        result = await client.call_tool(name, arguments)
        return result[0].text if result else ""
