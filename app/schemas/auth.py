from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr

ExperienceLevel = Literal["student", "fresher", "experienced", "manager"]


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    skills: list[str] = []
    desired_salary_min: int | None = None
    desired_salary_max: int | None = None
    preferred_cities: list[str] = []
    desired_titles: list[str] = []
    experience_level: ExperienceLevel | None = None
    university: str | None = None
    graduation_year: int | None = None
    open_to_internship: bool = False
    part_time_ok: bool = False


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    skills: list[str]
    desired_salary_min: int | None
    desired_salary_max: int | None
    preferred_cities: list[str]
    desired_titles: list[str]
    is_admin: bool
    subscription_tier: str
    experience_level: str | None
    university: str | None
    graduation_year: int | None
    open_to_internship: bool
    part_time_ok: bool
    cv_file_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    skills: list[str] | None = None
    desired_salary_min: int | None = None
    desired_salary_max: int | None = None
    preferred_cities: list[str] | None = None
    desired_titles: list[str] | None = None
    experience_level: ExperienceLevel | None = None
    university: str | None = None
    graduation_year: int | None = None
    open_to_internship: bool | None = None
    part_time_ok: bool | None = None
