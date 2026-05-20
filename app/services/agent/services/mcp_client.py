"""MCP Client — connect to MCP server, call tools."""

from fastmcp import Client

from app.services.agent.config import cfg

_client: Client | None = None


async def get_mcp_client() -> Client:
    global _client
    if _client is None:
        _client = Client(cfg["mcp"]["server_url"])
    return _client


async def call_mcp_tool(name: str, arguments: dict) -> str:
    client = await get_mcp_client()
    result = await client.call_tool(name, arguments)
    return result[0].text if result else ""


async def close_mcp_client() -> None:
    global _client
    if _client:
        await _client.close()
        _client = None
