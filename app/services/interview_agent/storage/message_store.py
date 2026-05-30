"""Interview message storage operations.

CRUD operations for interview_messages table.
Uses SQLAlchemy async for database operations.
"""

from typing import Optional
from uuid import UUID

from sqlalchemy import select

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory
from app.models.interview import InterviewMessage


async def create_message(
    session_id: UUID,
    role: str,
    content: str,
    audio_url: Optional[str] = None,
    original_audio_url: Optional[str] = None,
) -> InterviewMessage:
    """Create a new interview message.

    Args:
        session_id: Interview session UUID
        role: "user" or "assistant"
        content: Message text content
        audio_url: Optional TTS audio URL (for assistant messages)
        original_audio_url: Optional STT audio URL (for user messages)

    Returns:
        Created InterviewMessage instance
    """
    async with async_session_factory() as db_sess:
        message = InterviewMessage(
            session_id=session_id,
            role=role,
            content=content,
            audio_url=audio_url,
            original_audio_url=original_audio_url,
        )
        db_sess.add(message)
        await db_sess.commit()
        await db_sess.refresh(message)
        return message


async def get_session_messages(
    session_id: UUID,
    limit: Optional[int] = None,
) -> list[InterviewMessage]:
    """Get all messages for a session.

    Args:
        session_id: Interview session UUID
        limit: Optional limit for pagination

    Returns:
        List of InterviewMessage ordered by created_at
    """
    async with async_session_factory() as db_sess:
        query = select(InterviewMessage).where(
            InterviewMessage.session_id == session_id
        )
        query = query.order_by(InterviewMessage.created_at.asc())

        if limit:
            query = query.limit(limit)

        result = await db_sess.execute(query)
        return list(result.scalars().all())


async def create_message_batch(
    messages: list[dict],
) -> list[InterviewMessage]:
    """Create multiple messages in a single transaction.

    Args:
        messages: List of message dicts with keys:
                  session_id, role, content, audio_url, original_audio_url

    Returns:
        List of created InterviewMessage instances
    """
    async with async_session_factory() as db_sess:
        message_objects = [
            InterviewMessage(
                session_id=msg["session_id"],
                role=msg["role"],
                content=msg["content"],
                audio_url=msg.get("audio_url"),
                original_audio_url=msg.get("original_audio_url"),
            )
            for msg in messages
        ]
        db_sess.add_all(message_objects)
        await db_sess.commit()

        # Refresh to get IDs and timestamps
        for msg in message_objects:
            await db_sess.refresh(msg)

        return message_objects
