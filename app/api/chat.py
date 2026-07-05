from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import database as db_module
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.chat import ChatMessage, ChatRoom
from app.models.user import User
from app.schemas.chat import (
    ChatMessageResponse,
    ChatMessageSend,
    ChatReplyResponse,
    ChatRoomCreate,
    ChatRoomResponse,
)
from app.services.agent import AgentContext, get_agent
from app.services.agent.chains.skill_advisor_chain import build_agent
from app.services.agent.tools.cv_edit_tool import make_edit_cv_tool

router = APIRouter(prefix="/api/chat", tags=["chat"])

logger = logging.getLogger(__name__)


# ─── Helpers ────────────────────────────────────────────────


def _build_profile_dict(user: User) -> dict:
    return {
        "full_name": user.full_name,
        "email": user.email,
        "skills": list(user.skills or []),
        "desired_titles": list(user.desired_titles or []),
        "experience_level": user.experience_level,
        "preferred_cities": list(user.preferred_cities or []),
        "desired_salary_min": user.desired_salary_min,
        "desired_salary_max": user.desired_salary_max,
        "university": user.university,
        "graduation_year": user.graduation_year,
    }


async def _load_chat_history(
    db: AsyncSession, room_id: uuid.UUID, limit: int = 20
) -> list[dict]:
    history = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    past_msgs = list(reversed(history.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in past_msgs]


# ─── Rooms ──────────────────────────────────────────────────


@router.get("/rooms", response_model=list[ChatRoomResponse])
async def list_rooms(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ChatRoom)
        .where(ChatRoom.user_id == current_user.id)
        .order_by(ChatRoom.updated_at.desc())
    )
    rooms = rows.scalars().all()

    result = []
    for room in rooms:
        last = await db.execute(
            select(ChatMessage.content)
            .where(ChatMessage.room_id == room.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(1)
        )
        preview = last.scalar_one_or_none()
        result.append(
            ChatRoomResponse(
                id=str(room.id),
                title=room.title,
                created_at=room.created_at,
                updated_at=room.updated_at,
                last_message=(
                    (preview[:80] + "...") if preview and len(preview) > 80 else preview
                ),
            )
        )
    return result


@router.post("/rooms", response_model=ChatRoomResponse, status_code=201)
async def create_room(
    body: ChatRoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = ChatRoom(user_id=current_user.id, title=body.title or "Cuộc trò chuyện mới")
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return ChatRoomResponse(
        id=str(room.id),
        title=room.title,
        created_at=room.created_at,
        updated_at=room.updated_at,
    )


@router.delete("/rooms/{room_id}", status_code=204)
async def delete_room(
    room_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")
    await db.delete(room)
    await db.commit()


# ─── Messages ───────────────────────────────────────────────


@router.get("/rooms/{room_id}/messages", response_model=list[ChatMessageResponse])
async def get_messages(
    room_id: str,
    limit: int = 50,
    before: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")

    q = (
        select(ChatMessage)
        .where(ChatMessage.room_id == uuid.UUID(room_id))
        .order_by(ChatMessage.created_at.asc())
        .limit(limit)
    )
    if before:
        q = q.where(ChatMessage.created_at < datetime.fromisoformat(before))

    rows = await db.execute(q)
    messages = rows.scalars().all()
    return [
        ChatMessageResponse(
            id=str(m.id), role=m.role, content=m.content, created_at=m.created_at
        )
        for m in messages
    ]


@router.post("/rooms/{room_id}/messages", response_model=ChatReplyResponse)
async def send_message(
    room_id: str,
    body: ChatMessageSend,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")

    # 1. Save user message
    user_msg = ChatMessage(
        room_id=uuid.UUID(room_id),
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    # 2. Auto-generate room title from first message
    if room.title == "Cuộc trò chuyện mới":
        room.title = body.content[:60] + ("..." if len(body.content) > 60 else "")

    await db.commit()
    await db.refresh(user_msg)

    # 3. Load recent history for context
    agent_messages = await _load_chat_history(db, uuid.UUID(room_id))

    # 4. Build context
    profile_dict = _build_profile_dict(current_user)
    agent_ctx = AgentContext(profile=profile_dict)

    # 5. Call agent
    agent = get_agent()
    result = await agent.ainvoke(
        {"messages": agent_messages},
        context=agent_ctx,
    )

    # 6. Extract reply
    last_msg = result["messages"][-1]
    reply_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    # 7. Save assistant message
    bot_msg = ChatMessage(
        room_id=uuid.UUID(room_id),
        role="assistant",
        content=reply_text,
    )
    db.add(bot_msg)

    # 8. Update room timestamp
    room.updated_at = func.now()

    await db.commit()
    await db.refresh(bot_msg)

    return ChatReplyResponse(
        user_message=ChatMessageResponse(
            id=str(user_msg.id),
            role=user_msg.role,
            content=user_msg.content,
            created_at=user_msg.created_at,
        ),
        assistant_message=ChatMessageResponse(
            id=str(bot_msg.id),
            role=bot_msg.role,
            content=bot_msg.content,
            created_at=bot_msg.created_at,
        ),
    )


# ─── Streaming ──────────────────────────────────────────────


@router.post("/rooms/{room_id}/messages/stream")
async def send_message_stream(
    room_id: str,
    body: ChatMessageSend,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(ChatRoom, uuid.UUID(room_id))
    if not room or room.user_id != current_user.id:
        raise HTTPException(404, "Room not found")

    # 1. Save user message
    user_msg = ChatMessage(
        room_id=uuid.UUID(room_id),
        role="user",
        content=body.content,
    )
    db.add(user_msg)

    # 2. Auto-generate room title from first message
    if room.title == "Cuộc trò chuyện mới":
        room.title = body.content[:60] + ("..." if len(body.content) > 60 else "")

    await db.commit()
    await db.refresh(user_msg)

    # 3. Load recent history
    agent_messages = await _load_chat_history(db, uuid.UUID(room_id))

    # 4. Build context
    profile_dict = _build_profile_dict(current_user)
    agent_ctx = AgentContext(profile=profile_dict)

    uid = uuid.UUID(room_id)

    async def _token_generator():
        cv_state = {"updated": False}

        def _on_cv_update(_summary: str) -> None:
            cv_state["updated"] = True

        edit_tool = make_edit_cv_tool(
            current_user.id, db_module.async_session_factory, _on_cv_update
        )
        agent = build_agent(extra_tools=[edit_tool])
        full_response = ""

        user_msg_data = {
            "type": "user_message",
            "id": str(user_msg.id),
            "role": user_msg.role,
            "content": user_msg.content,
            "created_at": user_msg.created_at.isoformat(),
        }
        yield f"data: {json.dumps(user_msg_data, ensure_ascii=False)}\n\n"

        try:
            async for chunk in agent.astream(
                {"messages": agent_messages},
                context=agent_ctx,
                stream_mode="messages",
            ):
                msg, metadata = chunk
                if isinstance(msg, AIMessageChunk) and msg.content:
                    full_response += msg.content
                    yield f"data: {json.dumps({'type': 'token', 'content': msg.content}, ensure_ascii=False)}\n\n"

            if cv_state["updated"]:
                yield f"data: {json.dumps({'type': 'cv_updated'}, ensure_ascii=False)}\n\n"

            # Save assistant message using a fresh DB session
            async with db_module.async_session_factory() as db_sess:
                bot_msg = ChatMessage(
                    room_id=uid,
                    role="assistant",
                    content=full_response,
                )
                db_sess.add(bot_msg)
                room_obj = await db_sess.get(ChatRoom, uid)
                if room_obj:
                    room_obj.updated_at = func.now()
                await db_sess.commit()
                await db_sess.refresh(bot_msg)

                done_payload = {
                    "type": "done",
                    "assistant_message": {
                        "id": str(bot_msg.id),
                        "role": bot_msg.role,
                        "content": bot_msg.content,
                        "created_at": bot_msg.created_at.isoformat(),
                    },
                }
                yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

        except Exception:
            logger.exception("Streaming error in room %s", room_id)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Loi khi tao phan hoi'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _token_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
