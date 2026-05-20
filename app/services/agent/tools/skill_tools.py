"""LangChain tools — thin wrappers calling MCP client."""

from langchain_core.tools import tool

from app.services.agent.services.mcp_client import call_mcp_tool


@tool
async def query_skill_gap(user_skills: str) -> str:
    """Query top in-demand skills that the user DOES NOT already have.
    Returns skill name, category, number of jobs, average salary.

    Args:
        user_skills: Comma-separated list of skills the user already knows.
    """
    return await call_mcp_tool("query_skill_gap", {"user_skills": user_skills})


@tool
async def get_user_profile(user_id: str) -> str:
    """Get user profile: skills, desired job titles, experience level.

    Args:
        user_id: The user's UUID.
    """
    return await call_mcp_tool("get_user_profile", {"user_id": user_id})
