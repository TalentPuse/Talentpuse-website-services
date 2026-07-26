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
    limit: Annotated[int, Field(description="Max skills to return", ge=1, le=50)] = 20,
) -> str:
    """Query top in-demand skills that the user DOES NOT already have.
    Returns skill name, number of jobs requiring it, average salary.

    KHONG loc duoc theo nganh: kho chi co dbt_dev_gold.mart_skill_demand, ma bang
    do khong he co chieu category (cot: skill, n_jobs, pct_of_jobs, avg_salary_vnd,
    ...). Truoc day ham nay NHAN tham so `category` roi lang le bo qua — nguoi goi
    tuong dang loc theo nganh nhung nhan ve so lieu cua toan bo thi truong."""
    skills = tuple(s.strip().lower() for s in user_skills.split(",") if s.strip())
    if not skills:
        return "Please provide at least one skill the user already knows."

    rows = await _skill_repo.gap(exclude_skills=skills, limit=limit)
    if not rows:
        return "No skill gap data found."

    lines = ["Skill gap analysis (skills user chưa có):\n"]
    for r in rows:
        lines.append(
            f"- {r.skill}: "
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
