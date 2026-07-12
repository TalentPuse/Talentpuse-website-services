from __future__ import annotations

from pydantic import BaseModel


class UserProfile(BaseModel):
    skills: list[str] = []
    desired_titles: list[str] = []
    experience_level: str | None = None
    preferred_cities: list[str] = []
    desired_salary_range: str | None = None
