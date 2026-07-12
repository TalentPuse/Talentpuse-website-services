from __future__ import annotations

from pydantic import BaseModel


class SkillGapRow(BaseModel):
    skill: str
    skill_category: str
    n_jobs: int
    avg_salary_m: float | None = None


class SkillDemandRow(BaseModel):
    skill: str
    skill_category: str
    n_jobs: int
    pct_of_jobs: float | None = None
    avg_salary_m: float | None = None


class SkillTrend(BaseModel):
    skill: str
    category: str | None = None
    trend_pct: float = 0.0
    latest_jobs: int = 0
    latest_salary_m: float | None = None
