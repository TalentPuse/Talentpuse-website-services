from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PublicJobRow(BaseModel):
    source: str
    source_job_id: str
    title: str | None
    company_name: str | None
    city_canonical: str | None
    job_level: str | None
    job_category: str | None
    salary_million: float | None
    source_url: str | None
    posted_at: datetime | None
    skills: list[str]


class PublicJobList(BaseModel):
    jobs: list[PublicJobRow]
    total: int
    page: int
    per_page: int


class FilterOptions(BaseModel):
    cities: list[str]
    levels: list[str]
    sources: list[str]


class MyAlertRow(BaseModel):
    source_job_id: str
    source: str | None
    title: str | None
    company_name: str | None
    city_canonical: str | None
    salary_million: float | None
    source_url: str | None
    sent_at: datetime
    channel: str


class MyAlertList(BaseModel):
    alerts: list[MyAlertRow]
    total: int
    page: int
    per_page: int
