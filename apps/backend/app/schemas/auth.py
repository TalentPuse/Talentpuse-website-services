from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

ExperienceLevel = Literal["student", "fresher", "experienced", "manager"]


# Chan tren PHAI khop kieu cot trong Postgres, khong phai "so nao cung duoc".
#
# `graduation_year` la smallint (toi da 32767): go nham 20255 — bat ky nam 5
# chu so nao — lam asyncpg nem loi va tra 500 KEM STACK TRACE thay vi 422, chan
# luon luong hoan thien ho so (JA-55). `desired_salary_*` la int4.
#
# Do dai chuoi cung vay: `full_name` la varchar(255), `university` la
# varchar(200) — ten dai kem hoc ham/hau to, hoac mot cu copy-paste nham, ra
# 500 thay vi mot thong bao doc duoc (JA-56).
LUONG_TOI_DA = 2_000_000_000       # duoi tran int4
NAM_TOT_NGHIEP_MIN = 1950
NAM_TOT_NGHIEP_MAX = 2100          # duoi tran smallint (32767)
DAI_TEN = 255
DAI_TRUONG = 200


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str = Field(min_length=1, max_length=DAI_TEN)
    skills: list[str] = []
    desired_salary_min: int | None = Field(None, ge=0, le=LUONG_TOI_DA)
    desired_salary_max: int | None = Field(None, ge=0, le=LUONG_TOI_DA)
    preferred_cities: list[str] = []
    desired_titles: list[str] = []
    experience_level: ExperienceLevel | None = None
    university: str | None = Field(None, max_length=DAI_TRUONG)
    graduation_year: int | None = Field(None, ge=NAM_TOT_NGHIEP_MIN, le=NAM_TOT_NGHIEP_MAX)
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
    # KHONG rang buoc do dai o day. Day la model TRA VE: mot dong cu trong DB
    # vi pham rang buoc se lam Pydantic nem loi luc serialize — bien du lieu
    # lich su thanh 500 tren duong DOC, dung cai ma JA-56 muon tranh.
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
    full_name: str | None = Field(None, min_length=1, max_length=DAI_TEN)
    skills: list[str] | None = None
    desired_salary_min: int | None = Field(None, ge=0, le=LUONG_TOI_DA)
    desired_salary_max: int | None = Field(None, ge=0, le=LUONG_TOI_DA)
    preferred_cities: list[str] | None = None
    desired_titles: list[str] | None = None
    experience_level: ExperienceLevel | None = None
    university: str | None = Field(None, max_length=DAI_TRUONG)
    graduation_year: int | None = Field(None, ge=NAM_TOT_NGHIEP_MIN, le=NAM_TOT_NGHIEP_MAX)
    open_to_internship: bool | None = None
    part_time_ok: bool | None = None
