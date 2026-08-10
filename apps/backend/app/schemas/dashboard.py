from __future__ import annotations

from pydantic import BaseModel


class Overview(BaseModel):
    total_jobs: int


class SkillRow(BaseModel):
    skill: str
    n_jobs: int
    pct_of_jobs: float


class DashboardRow(BaseModel):
    name: str
    n_jobs: int
    pct_of_jobs: float


class CompanyRow(BaseModel):
    company_name: str
    n_jobs: int
    primary_city: str | None
    avg_views: float | None