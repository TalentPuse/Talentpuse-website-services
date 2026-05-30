"""LangChain tools — Real-time job search via MCP."""
from langchain_core.tools import tool

from app.services.agent.services.mcp_client import call_mcp_tool


@tool
async def search_jobs_realtime(query: str, location: str = "Vietnam") -> str:
    """Search real-time job listings on LinkedIn, Indeed, and Glassdoor for Vietnam market.

    Use when user asks to find jobs, search for positions, wants current job openings,
    or asks "co job nao khong", "tim viec", "search job".

    Args:
        query: Job title or keywords (e.g. "Data Engineer", "Python Developer", "AI Research")
        location: City in Vietnam (e.g. "Ho Chi Minh City", "Ha Noi", "Da Nang") or "Vietnam" for nationwide.
    """
    return await call_mcp_tool("search_jobs_realtime", {
        "query": query,
        "location": location,
    })
