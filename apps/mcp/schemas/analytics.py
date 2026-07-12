from __future__ import annotations

from pydantic import BaseModel


class SystemStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    telegram_linked: int = 0
    alerts_today: int = 0
    alerts_this_week: int = 0
    total_alerts: int = 0


class JobOverview(BaseModel):
    total_active_jobs: int = 0
    avg_salary_m: float | None = None
    min_salary_m: float | None = None
    max_salary_m: float | None = None


class CategoryCount(BaseModel):
    job_category: str | None = None
    city_canonical: str | None = None
    n_jobs: int = 0


class SalaryRow(BaseModel):
    job_level: str | None = None
    city_canonical: str | None = None
    n_jobs: int = 0
    p25_m: float | None = None
    p50_m: float | None = None
    p75_m: float | None = None


class CompanyRow(BaseModel):
    company_name: str
    active_jobs: int = 0
    avg_salary_m: float | None = None
    primary_city: str | None = None


class JobMarketOverview(BaseModel):
    overview: JobOverview
    top_categories: list[CategoryCount] = []
    top_cities: list[CategoryCount] = []
