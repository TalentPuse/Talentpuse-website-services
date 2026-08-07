"""Schema extract JD — xem spec docs/superpowers/specs/2026-08-07-jd-insight-api-design.md."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

SENIORITY = Literal["intern", "fresher", "junior", "mid", "senior", "lead", "manager"]
WORK_TYPE = Literal["fulltime", "contract", "internship", "parttime"]
REMOTE = Literal["remote", "hybrid", "onsite"]
EDU_LEVEL = Literal["university", "college", "none"]


class Extra(BaseModel):
    aspect: str = Field(min_length=1, max_length=50)
    value: str = Field(min_length=1, max_length=500)


class Language(BaseModel):
    lang: str
    level: str | None = None


class JobRef(BaseModel):
    source: str
    source_job_id: str
    title: str | None = None
    company_name: str | None = None
    job_level: str | None = None
    job_category: str | None = None
    city_canonical: str | None = None


class Summary(BaseModel):
    role_summary: str | None = None
    seniority_hint: SENIORITY | None = None


class Skills(BaseModel):
    hard: list[str] = Field(default_factory=list)
    soft: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)
    languages: list[Language] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)


class YearsExperience(BaseModel):
    min: int | None = None
    max: int | None = None
    raw: str | None = None


class Education(BaseModel):
    level: EDU_LEVEL | None = None
    major: str | None = None


class Requirements(BaseModel):
    years_experience: YearsExperience = Field(default_factory=YearsExperience)
    education: Education = Field(default_factory=Education)
    work_type: WORK_TYPE | None = None
    remote: REMOTE | None = None
    other: list[str] = Field(default_factory=list)


class JdInsight(BaseModel):
    job: JobRef
    summary: Summary = Field(default_factory=Summary)
    skills: Skills = Field(default_factory=Skills)
    requirements: Requirements = Field(default_factory=Requirements)
    responsibilities: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    extras: Annotated[list[Extra], Field(max_length=10)] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _bo_qua_salary_duoc_phep(cls, data):
        # Cho phep LLM tra ca salary (neu JD co) — ta BO QUA o day vi san pham
        # khong ban salary; chi giu extras.salary_note neu co.
        if isinstance(data, dict):
            data.pop("salary", None)
        return data
