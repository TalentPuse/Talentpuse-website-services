"""Interview session storage operations.

CRUD operations for interview_sessions table.
Uses SQLAlchemy async for database operations.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import database as db_module
from app.models.interview import InterviewSession


async def create_session(
    user_id: UUID,
    mode: str,
    target_role: Optional[str] = None,
    num_questions: int = 5,
) -> InterviewSession:
    """Create a new interview session.

    Args:
        user_id: User UUID
        mode: "technical" or "behavioral"
        target_role: Optional target job role
        num_questions: Number of questions planned

    Returns:
        Created InterviewSession instance
    """
    async with db_module.async_session_factory() as db_sess:
        session = InterviewSession(
            user_id=user_id,
            mode=mode,
            status="created",
            target_role=target_role,
            question_count=0,
            total_questions=num_questions,
        )
        db_sess.add(session)
        await db_sess.commit()
        await db_sess.refresh(session)
        return session


async def get_session(session_id: UUID) -> Optional[InterviewSession]:
    """Get interview session by ID.

    Args:
        session_id: Session UUID

    Returns:
        InterviewSession or None if not found
    """
    async with db_module.async_session_factory() as db_sess:
        result = await db_sess.execute(
            select(InterviewSession).where(InterviewSession.id == session_id)
        )
        return result.scalars().first()


async def update_session(
    session_id: UUID,
    **kwargs,
) -> Optional[InterviewSession]:
    """Update interview session fields.

    Args:
        session_id: Session UUID
        **kwargs: Fields to update (status, question_count, overall_score, etc.)

    Returns:
        Updated InterviewSession or None if not found
    """
    async with db_module.async_session_factory() as db_sess:
        await db_sess.execute(
            update(InterviewSession)
            .where(InterviewSession.id == session_id)
            .values(**kwargs)
        )
        await db_sess.commit()
        return await get_session(session_id)


async def list_user_sessions(
    user_id: UUID,
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
) -> list[InterviewSession]:
    """List user's interview sessions.

    Args:
        user_id: User UUID
        limit: Max results
        offset: Pagination offset
        status: Optional filter by status

    Returns:
        List of InterviewSession
    """
    async with db_module.async_session_factory() as db_sess:
        query = select(InterviewSession).where(InterviewSession.user_id == user_id)

        if status:
            query = query.where(InterviewSession.status == status)

        query = query.order_by(InterviewSession.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await db_sess.execute(query)
        return list(result.scalars().all())
