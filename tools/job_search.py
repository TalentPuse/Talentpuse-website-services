"""MCP Tool — Real-time job search via jobspy."""
from __future__ import annotations

from typing import Annotated

from fastmcp.tools import tool
from pydantic import Field
from tenacity import retry, stop_after_attempt, wait_exponential

from mcp_server.services.jobspy_service import search_jobs


@tool(tags={"search", "realtime"})
@retry(stop=stop_after_attempt(2), wait=wait_exponential(min=2, max=15))
async def search_jobs_realtime(
    query: Annotated[
        str,
        Field(description="Job title or keyword to search, e.g. 'Data Engineer', 'AI Research', 'Python Developer'"),
    ],
    location: Annotated[
        str,
        Field(description="City or region in Vietnam: 'Ho Chi Minh City', 'Ha Noi', 'Da Nang', 'Vietnam' (nationwide)"),
    ] = "Vietnam",
    sources: Annotated[
        str,
        Field(description="Comma-separated job sites to search: 'linkedin', 'indeed', 'glassdoor'"),
    ] = "linkedin,indeed",
    results_wanted: Annotated[
        int,
        Field(description="Max results to return", ge=1, le=50),
    ] = 15,
    hours_old: Annotated[
        int,
        Field(description="Only return jobs posted within N hours", ge=1, le=720),
    ] = 72,
    is_remote: Annotated[
        bool,
        Field(description="Set true to filter remote-only jobs"),
    ] = False,
) -> str:
    """Search real-time jobs on LinkedIn, Indeed, and Glassdoor for Vietnam IT market.

    Returns job listings with title, company, salary, location, URL, and description snippet.
    Use this tool when the user asks to find jobs, search for positions, or wants current job openings.
    """
    source_list = [s.strip() for s in sources.split(",") if s.strip()]

    result = await search_jobs(
        query=query,
        location=location,
        sources=source_list,
        results_wanted=results_wanted,
        hours_old=hours_old,
        is_remote=is_remote,
    )

    return result.model_dump_json(ensure_ascii=False)
