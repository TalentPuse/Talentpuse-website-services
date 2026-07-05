from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field


class Header(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    location: str | None = None
    linkedin: str | None = None
    github: str | None = None
    website: str | None = None


class EducationItem(BaseModel):
    institution: str
    degree: str
    field: str | None = None
    start: str | None = None
    end: str | None = None
    gpa: str | None = None
    highlights: list[str] = Field(default_factory=list)


class ExperienceItem(BaseModel):
    company: str
    title: str
    location: str | None = None
    start: str
    end: str
    bullets: list[str] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str
    url: str | None = None
    date: str | None = None
    tech: list[str] = Field(default_factory=list)
    bullets: list[str] = Field(default_factory=list)


class Skills(BaseModel):
    technical: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)


class ResumeModel(BaseModel):
    header: Header
    summary: str | None = None
    education: list[EducationItem] = Field(default_factory=list)
    experience: list[ExperienceItem] = Field(default_factory=list)
    projects: list[ProjectItem] = Field(default_factory=list)
    skills: Skills = Field(default_factory=Skills)
