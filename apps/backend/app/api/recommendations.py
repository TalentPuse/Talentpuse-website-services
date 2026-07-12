"""Personalized, warehouse-grounded career recommendations for the logged-in user."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.recommendations import build_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("")
async def get_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return a data-driven career recommendation for the current user:
    matching-job count, role-specific skill gaps (with job counts + salary),
    a salary reality-check, top hiring companies, and an LLM narrative — all
    grounded in the live warehouse."""
    return await build_recommendations(db, current_user)
