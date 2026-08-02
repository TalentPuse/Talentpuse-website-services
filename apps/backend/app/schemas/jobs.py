from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class PublicJobRow(BaseModel):
    source: str
    source_job_id: str
    title: str | None
    company_name: str | None
    # Logo cong ty, lay tu silver_job_detail. Phu 923/931 tin (99%) tren ca 4
    # nguon, nen bo cuc danh sach co the lay logo lam neo thi giac; so con lai
    # roi ve chu cai dau (Monogram) o phia frontend.
    company_logo_url: str | None = None
    city_canonical: str | None
    job_level: str | None
    job_category: str | None
    salary_million: float | None
    source_url: str | None
    posted_at: datetime | None
    skills: list[str]
    match_score: int | None = None


class PublicJobList(BaseModel):
    jobs: list[PublicJobRow]
    total: int
    page: int
    per_page: int
    # So tin THUC SU duoc cham diem o lan rerank nay. UI phai hien con so nay:
    # cat bot am tham se doc thanh "da xet het kho" trong khi khong phai.
    scored_pool: int | None = None


class FilterOptions(BaseModel):
    cities: list[str]
    levels: list[str]
    sources: list[str]
    categories: list[str]


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


class JobMatch(BaseModel):
    score: int
    reasons: list[str] = []
    matched_skills: list[str] = []
    missing_skills: list[str] = []
    skill_basis: str = "none"
    skills_matched: int = 0
    skills_total: int = 0
    criteria_used: list[str] = []


class JobDetail(BaseModel):
    source: str
    source_job_id: str
    title: str | None = None
    company_name: str | None = None
    company_logo_url: str | None = None
    company_size_label: str | None = None
    city_canonical: str | None = None
    primary_address: str | None = None
    job_level: str | None = None
    job_category: str | None = None
    employment_type: str | None = None
    years_of_experience: int | None = None
    working_days: str | None = None
    degree_label: str | None = None
    salary_million: float | None = None
    salary_min_million: float | None = None
    salary_max_million: float | None = None
    description: str | None = None
    requirement: str | None = None
    benefits: list[str] = []
    skills: list[str] = []
    source_url: str | None = None
    posted_at: datetime | None = None
    expired_at: datetime | None = None
    num_of_views: int | None = None
    num_of_applications: int | None = None
    # None khi ho so nguoi dung con rong — UI moi ho dien ho so, KHONG hien 0%.
    match: JobMatch | None = None
