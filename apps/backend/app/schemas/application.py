import datetime
import uuid
from typing import Literal, Optional

from pydantic import BaseModel, model_validator

Status = Literal["saved", "applied", "interviewing", "offer", "rejected"]


class ApplicationCreate(BaseModel):
    source: Optional[str] = None
    source_job_id: Optional[str] = None
    title: Optional[str] = None
    company_name: Optional[str] = None
    city: Optional[str] = None
    source_url: Optional[str] = None
    salary_million: Optional[float] = None
    status: Status = "applied"
    applied_at: Optional[datetime.date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def _needs_internal_or_title(self):
        is_internal = self.source is not None and self.source_job_id is not None
        if not is_internal and not (self.title and self.title.strip()):
            raise ValueError("Provide (source + source_job_id) or a title")
        return self


class ApplicationUpdate(BaseModel):
    status: Optional[Status] = None
    notes: Optional[str] = None
    applied_at: Optional[datetime.date] = None


class ApplicationOut(BaseModel):
    id: uuid.UUID
    source: str
    source_job_id: Optional[str]
    title: str
    company_name: Optional[str]
    city: Optional[str]
    source_url: Optional[str]
    salary_million: Optional[float]
    status: str
    applied_at: Optional[datetime.date]
    notes: Optional[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class ApplicationList(BaseModel):
    applications: list[ApplicationOut]
    total: int
    page: int
    per_page: int


class StatsOut(BaseModel):
    total: int
    by_status: dict[str, int]
    applied_this_week: int


class TrackedKey(BaseModel):
    source: str
    source_job_id: str


class SummaryOut(BaseModel):
    summary_md: str
    generated_at: datetime.datetime
