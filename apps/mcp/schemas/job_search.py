"""Schemas for real-time job search via jobspy."""
from __future__ import annotations

from pydantic import BaseModel, Field


class JobSearchResult(BaseModel):
    """Single job result from real-time search."""

    title: str
    employer: str
    location: str | None = None
    salary: str | None = None
    job_url: str
    job_url_direct: str | None = None
    date_posted: str | None = None
    job_type: str | None = None
    job_level: str | None = None
    is_remote: bool | None = None
    description_snippet: str | None = Field(None, description="First 300 chars of description")
    source: str = Field(description="linkedin | indeed | glassdoor")
    skills: list[str] | None = None
    company_industry: str | None = None


class JobSearchResponse(BaseModel):
    """Response from real-time job search."""

    success: bool
    total_found: int
    jobs: list[JobSearchResult]
    source_errors: list[str] | None = None
    search_meta: dict = Field(
        description="query, location, sources used, time taken"
    )
