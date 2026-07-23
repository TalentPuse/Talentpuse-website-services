from __future__ import annotations

from typing import Annotated

from fastmcp.tools import tool
from pydantic import Field
from tenacity import retry, stop_after_attempt, wait_exponential

from mcp_server.repositories import AnalyticsRepository, SkillRepository

_analytics_repo = AnalyticsRepository()
_skill_repo = SkillRepository()


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_system_stats() -> str:
    """Get TalentPulse system stats: total users, active users, telegram connections,
    alerts sent today/this week/total."""
    result = await _analytics_repo.system_stats()
    return result.model_dump_json(ensure_ascii=False)


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_job_market_overview(
    category: Annotated[
        str | None,
        Field(description="Filter by job category, e.g. 'AI Engineer', 'Data Engineer'"),
    ] = None,
    city: Annotated[
        str | None,
        Field(description="Filter by city, e.g. 'Ho Chi Minh', 'Ha Noi'"),
    ] = None,
) -> str:
    """Get job market overview: total active jobs, salary stats, breakdown by category and city."""
    result = await _analytics_repo.job_market_overview(category=category, city=city)
    return result.model_dump_json(ensure_ascii=False)


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_top_skills(
    category: Annotated[
        str | None,
        Field(description="Filter by skill category: ai_ml, programming_languages, etc."),
    ] = None,
    limit: Annotated[int, Field(description="Number of skills", ge=1, le=50)] = 15,
) -> str:
    """Get top in-demand skills across all jobs. Returns skill name, number of jobs, average salary."""
    rows = await _skill_repo.demand(category=category, limit=limit)
    return f"[{','.join(r.model_dump_json() for r in rows)}]"


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_salary_analysis(
    job_level: Annotated[
        str | None,
        Field(description="Filter by level: intern, fresher, junior, mid, senior, lead, manager"),
    ] = None,
    city: Annotated[str | None, Field(description="Filter by city")] = None,
) -> str:
    """Get salary distribution by level and city. Returns P25, P50 (median), P75 salaries."""
    rows = await _analytics_repo.salary(job_level=job_level, city=city)
    return f"[{','.join(r.model_dump_json() for r in rows)}]"


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_top_companies(
    limit: Annotated[int, Field(description="Number of companies", ge=1, le=50)] = 15,
) -> str:
    """Get top hiring companies by active job count. Includes avg salary and primary city."""
    rows = await _analytics_repo.top_companies(limit=limit)
    return f"[{','.join(r.model_dump_json() for r in rows)}]"


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_salary_benchmark(
    job_category: Annotated[
        str | None,
        Field(description="Filter by job category, e.g. 'AI Engineer', 'Backend Developer'"),
    ] = None,
    job_level: Annotated[
        str | None,
        Field(description="Filter by level: intern, fresher, junior, mid, senior, lead, manager"),
    ] = None,
    city: Annotated[
        str | None,
        Field(description="Filter by city, e.g. 'Ho Chi Minh', 'Ha Noi'"),
    ] = None,
) -> str:
    """Get salary benchmark percentiles (P25/P50/P75) plus avg/min/max, in millions VND per month,
    broken down by job category, level, city and region. Use this to judge whether a salary offer
    is competitive for a given role, level and location. Filters are optional and combinable."""
    rows = await _analytics_repo.salary_benchmark(
        job_category=job_category, job_level=job_level, city=city
    )
    return f"[{','.join(r.model_dump_json() for r in rows)}]"


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_company_hiring(
    company_name: Annotated[
        str,
        Field(description="Company name to search for, e.g. 'FPT Software', 'VNG'"),
    ],
) -> str:
    """Check whether a company is actively hiring: number of open jobs, average views/applicants
    per job, salary range, and primary city/region. Matches company_name case-insensitively and by
    partial substring, since company names are typed inconsistently across job sources. Returns an
    empty list if no matching company is found in the warehouse — do not assume zero hiring activity."""
    rows = await _analytics_repo.company_hiring(company_name=company_name)
    return f"[{','.join(r.model_dump_json() for r in rows)}]"


@tool(tags={"analytics", "readonly"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_skill_trends(
    weeks: Annotated[int, Field(description="Recent weeks to analyze", ge=1, le=12)] = 4,
    limit: Annotated[int, Field(description="Top N trending skills", ge=1, le=30)] = 15,
) -> str:
    """Get skill demand trends over recent weeks. Shows which skills are trending up or down."""
    rows = await _skill_repo.trends(weeks=weeks, limit=limit)
    if not rows:
        return "No trend data available."
    return f"[{','.join(r.model_dump_json() for r in rows)}]"
