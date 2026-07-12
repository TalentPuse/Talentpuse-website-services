from __future__ import annotations
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, EmailStr, Field, TypeAdapter

_email_adapter = TypeAdapter(EmailStr)


def _email_or_none(v: Any) -> Any:
    """Model nay nhan output cua LLM, khong phai form nguoi dung nhap.

    CV khong ghi email (hoac LLM khong tim thay) -> "" -> EmailStr bat buoc nem
    ValidationError -> RuntimeError -> GET /api/cv/document tra 502. Email chi la
    mot dong trong header CV, khong dang chan ca viec render, nen ha xuong None.
    Template da co san guard `if model.header.email`.
    """
    if v is None or not str(v).strip():
        return None
    try:
        return _email_adapter.validate_python(v)
    except Exception:
        return None


class Link(BaseModel):
    label: str | None = None
    url: str | None = None


class Header(BaseModel):
    full_name: str
    email: Annotated[EmailStr | None, BeforeValidator(_email_or_none)] = None
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    github: str | None = None
    website: str | None = None


class EducationItem(BaseModel):
    institution: str
    degree: str | None = None
    field: str | None = None
    start: str | None = None
    end: str | None = None
    gpa: str | None = None
    highlights: list[str] = Field(default_factory=list)


class ExperienceItem(BaseModel):
    company: str
    title: str
    location: str | None = None  # right-aligned tag: Remote / Full-time / city
    start: str | None = None
    end: str | None = None
    bullets: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str
    role: str | None = None
    date: str | None = None
    description: str | None = None
    tech: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)
    achievement: str | None = None
    links: list[Link] = Field(default_factory=list)
    url: str | None = None


class SkillGroup(BaseModel):
    category: str
    items: list[str] = Field(default_factory=list)


class CertItem(BaseModel):
    title: str
    issuer: str | None = None
    date: str | None = None
    bullets: list[str] = Field(default_factory=list)


class ResumeModel(BaseModel):
    header: Header
    summary: str | None = None
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    skills: list[SkillGroup] = Field(default_factory=list)
    honors: list[str] = Field(default_factory=list)
    certifications: list[CertItem] = Field(default_factory=list)
