from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, Integer, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "app"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    skills: Mapped[list[str]] = mapped_column(ARRAY(String), server_default="{}")
    desired_salary_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    desired_salary_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_cities: Mapped[list[str]] = mapped_column(ARRAY(String), server_default="{}")
    desired_titles: Mapped[list[str]] = mapped_column(ARRAY(String), server_default="{}")
    is_active: Mapped[bool] = mapped_column(default=True)
    is_admin: Mapped[bool] = mapped_column(default=False)
    subscription_tier: Mapped[str] = mapped_column(String(20), server_default="free")
    experience_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    university: Mapped[str | None] = mapped_column(String(200), nullable=True)
    graduation_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    open_to_internship: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    part_time_ok: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    cv_file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
