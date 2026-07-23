"""LangChain tools — market/salary analytics, thin wrappers calling MCP client."""

from langchain_core.tools import tool

from app.services.agent.services.mcp_client import call_mcp_tool


@tool
async def salary_benchmark(
    job_category: str | None = None,
    job_level: str | None = None,
    city: str | None = None,
) -> str:
    """Get salary benchmark percentiles (P25/P50/P75) plus avg/min/max, in millions VND
    per month, broken down by job category, level, city and region. Use this when the
    user asks whether an offer or posted salary is good, wants to know typical/market
    salary for a role, or wants to compare pay across levels or cities. All filters are
    optional and combinable — call with no filters for an overall benchmark.

    Args:
        job_category: Job category to filter by, e.g. 'AI Engineer', 'Backend Developer'.
        job_level: Level to filter by: intern, fresher, junior, mid, senior, lead, manager.
        city: City to filter by, e.g. 'Ho Chi Minh', 'Ha Noi'.
    """
    return await call_mcp_tool(
        "get_salary_benchmark",
        {"job_category": job_category, "job_level": job_level, "city": city},
    )


@tool
async def company_hiring(company: str) -> str:
    """Check whether a specific company is actively hiring: number of open jobs, average
    views/applicants per job, salary range, and primary city/region. Use this when the
    user asks about a named company's hiring activity, e.g. "Is FPT Software hiring?" or
    "What does VNG pay?". Matches the company name case-insensitively and by partial
    substring. May return an empty result if the company has no matching postings in the
    warehouse — that means no data was found, not that the company has zero hiring activity.

    Args:
        company: Company name to search for, e.g. 'FPT Software', 'VNG'.
    """
    return await call_mcp_tool("get_company_hiring", {"company_name": company})
