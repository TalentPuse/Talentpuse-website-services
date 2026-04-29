from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    skills: list[str] = []
    desired_salary_min: int | None = None
    desired_salary_max: int | None = None
    preferred_cities: list[str] = []
    desired_titles: list[str] = []


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
    created_at: datetime

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    skills: list[str] | None = None
    desired_salary_min: int | None = None
    desired_salary_max: int | None = None
    preferred_cities: list[str] | None = None
    desired_titles: list[str] | None = None
