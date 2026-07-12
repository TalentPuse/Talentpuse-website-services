from __future__ import annotations

from typing import Annotated

from fastmcp.tools import tool
from pydantic import Field
from tenacity import retry, stop_after_attempt, wait_exponential

from mcp_server.repositories import UserRepository, SkillRepository


_user_repo = UserRepository()
_skill_repo = SkillRepository()


@tool(tags={"skill", "recommend"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def query_skill_gap(
    user_skills: Annotated[
        str,
        Field(
            description="Comma-separated skills the user already knows, e.g. 'python,sql,docker'"
        ),
    ],
    category: Annotated[
        str | None,
        Field(
            description="Filter by category: ai_ml, programming_languages, frameworks_libraries, cloud_platforms, databases, devops_tools, data_engineering, soft_skills"
        ),
    ] = None,
    limit: Annotated[int, Field(description="Max skills to return", ge=1, le=50)] = 20,
) -> str:
    """Query top in-demand skills that the user DOES NOT already have.
    Returns skill name, category, number of jobs requiring it, average salary."""
    skills = tuple(s.strip().lower() for s in user_skills.split(",") if s.strip())
    if not skills:
        return "Please provide at least one skill the user already knows."

    rows = await _skill_repo.gap(exclude_skills=skills, category=category, limit=limit)
    if not rows:
        return "No skill gap data found."

    lines = ["Skill gap analysis (skills user chưa có):\n"]
    for r in rows:
        lines.append(
            f"- {r.skill} ({r.skill_category}): "
            f"{r.n_jobs} jobs, avg {r.avg_salary_m or '?'}M VND"
        )
    return "\n".join(lines)


@tool(tags={"skill", "recommend"})
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def get_user_profile(
    user_id: Annotated[str, Field(description="User UUID")],
) -> str:
    """Get user profile: skills, desired job titles, experience level, preferred cities."""
    profile = await _user_repo.get_by_id(user_id)
    if not profile:
        return f"User {user_id} not found."
    return profile.model_dump_json(ensure_ascii=False)
