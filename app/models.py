"""Pydantic response schemas — match shape returned to frontend."""
from __future__ import annotations

from pydantic import BaseModel


class Overview(BaseModel):
    total_jobs: int
    pct_with_salary: float
    avg_salary_million: float | None


class SkillRow(BaseModel):
    skill: str
    n_jobs: int
    pct_of_jobs: float


class HighestPayingSkillRow(BaseModel):
    skill: str
    n_jobs: int
    avg_salary_million: float


class SalaryByLevelRow(BaseModel):
    level_city: str
    job_level: str
    city_canonical: str
    p25_million: float
    p50_million: float
    p75_million: float
    n_visible_jobs: int


class CompanyRow(BaseModel):
    company_name: str
    n_jobs: int
    primary_city: str | None
    avg_views: float | None
    avg_salary_million: float | None
