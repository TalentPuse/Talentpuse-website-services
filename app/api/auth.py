from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.auth import Token, UserCreate, UserLogin, UserResponse, UserUpdate
from app.services.auth import authenticate_user, create_user, get_user_by_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(data: UserCreate, db: AsyncSession = Depends(get_db)) -> Token:
    if len(data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu phải có ít nhất 8 ký tự",
        )
    existing = await get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email đã được đăng ký",
        )
    _, token = await create_user(db, data)
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)) -> Token:
    result = await authenticate_user(db, data.email, data.password)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không đúng",
        )
    _, token = result
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        skills=current_user.skills or [],
        desired_salary_min=current_user.desired_salary_min,
        desired_salary_max=current_user.desired_salary_max,
        preferred_cities=current_user.preferred_cities or [],
        desired_titles=current_user.desired_titles or [],
        is_admin=current_user.is_admin,
        subscription_tier=current_user.subscription_tier,
        experience_level=current_user.experience_level,
        university=current_user.university,
        graduation_year=current_user.graduation_year,
        open_to_internship=current_user.open_to_internship,
        part_time_ok=current_user.part_time_ok,
        created_at=current_user.created_at,
    )


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    if data.full_name is not None:
        current_user.full_name = data.full_name
    if data.skills is not None:
        current_user.skills = data.skills
    if data.desired_salary_min is not None:
        current_user.desired_salary_min = data.desired_salary_min
    if data.desired_salary_max is not None:
        current_user.desired_salary_max = data.desired_salary_max
    if data.preferred_cities is not None:
        current_user.preferred_cities = data.preferred_cities
    if data.desired_titles is not None:
        current_user.desired_titles = data.desired_titles
    if data.experience_level is not None:
        current_user.experience_level = data.experience_level
    if data.university is not None:
        current_user.university = data.university
    if data.graduation_year is not None:
        current_user.graduation_year = data.graduation_year
    if data.open_to_internship is not None:
        current_user.open_to_internship = data.open_to_internship
    if data.part_time_ok is not None:
        current_user.part_time_ok = data.part_time_ok
    await db.commit()
    await db.refresh(current_user)
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        skills=current_user.skills or [],
        desired_salary_min=current_user.desired_salary_min,
        desired_salary_max=current_user.desired_salary_max,
        preferred_cities=current_user.preferred_cities or [],
        desired_titles=current_user.desired_titles or [],
        is_admin=current_user.is_admin,
        subscription_tier=current_user.subscription_tier,
        experience_level=current_user.experience_level,
        university=current_user.university,
        graduation_year=current_user.graduation_year,
        open_to_internship=current_user.open_to_internship,
        part_time_ok=current_user.part_time_ok,
        created_at=current_user.created_at,
    )
