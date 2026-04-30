from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import UserCreate


async def create_user(db: AsyncSession, data: UserCreate) -> tuple[User, str]:
    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        skills=data.skills,
        desired_salary_min=data.desired_salary_min,
        desired_salary_max=data.desired_salary_max,
        preferred_cities=data.preferred_cities,
        desired_titles=data.desired_titles,
        experience_level=data.experience_level,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return user, token


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> tuple[User, str] | None:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.hashed_password):
        return None
    token = create_access_token({"sub": str(user.id), "is_admin": user.is_admin})
    return user, token


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()
