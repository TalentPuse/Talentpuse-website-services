"""Interview API Router.

FastAPI router for interview session management.
All endpoints are prefixed with /api/interview

Uses LangChain for agent streaming (same pattern as chat.py)
"""

import json
import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessageChunk
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.core import database as db_module
from app.models.interview import InterviewMessage, InterviewSession
from app.models.user import User
from app.services.agent import AgentContext
from app.services.interview_agent.chains import get_interview_agent
from app.services.interview_agent.evaluation import generate_session_summary
from app.services.interview_agent.models.schemas import (
    SessionCreateRequest,
    SessionResponse,
    MessageCreateRequest,
    SessionCompleteRequest,
    SessionSummaryResponse,
    MessageResponse,
)
from app.services.interview_agent.storage import (
    create_session,
    get_session,
    update_session,
    list_user_sessions,
    create_message,
    get_session_messages,
)

router = APIRouter(prefix="/api/interview-agent", tags=["interview-agent"])
logger = logging.getLogger(__name__)


# =============================================================================
# Helpers
# =============================================================================


def _build_profile_dict(user: User) -> dict:
    """Build user profile dict for agent context."""
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


async def _load_session_history(
    db: AsyncSession, session_id: uuid.UUID, limit: int = 20
) -> list[dict]:
    """Load message history for context."""
    history = await db.execute(
        select(db_module.interview.InterviewMessage)
        .where(db_module.interview.InterviewMessage.session_id == session_id)
        .order_by(db_module.interview.InterviewMessage.created_at.desc())
        .limit(limit)
    )
    past_msgs = list(reversed(history.scalars().all()))
    return [{"role": m.role, "content": m.content} for m in past_msgs]


def _session_to_response(session, messages: list = None) -> SessionResponse:
    """Convert database session to API response."""
    return SessionResponse(
        id=session.id,
        user_id=session.user_id,
        mode=session.mode,  # type: ignore
        status=session.status,  # type: ignore
        target_role=session.target_role,
        question_count=session.question_count,
        overall_score=session.overall_score,
        overall_feedback=session.overall_feedback,
        improvement_plan=session.improvement_plan,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[_message_to_response(m) for m in (messages or [])],
    )


def _message_to_response(message) -> MessageResponse:
    """Convert database message to API response."""
    return MessageResponse(
        id=message.id,
        session_id=message.session_id,
        role=message.role,  # type: ignore
        content=message.content,
        audio_url=message.audio_url,
        created_at=message.created_at,
    )


def _generate_greeting(mode: str, target_role: str = None) -> str:
    """Generate opening greeting for interview session."""
    if mode == "technical":
        role_text = f"cho vị trí {target_role}" if target_role else ""
        return (
            f"Xin chào! Tôi là interviewer kỹ thuật hôm nay {role_text}. "
            f"Buổi phỏng vấn này sẽ bao gồm các câu hỏi về system design, algorithms, "
            f"và coding. Hãy thoải mái chia sẻ tư duy của bạn — chúng tôi quan tâm "
            f"đến cách bạn approach vấn đề hơn là chỉ đúng/sai. Bạn đã sẵn sàng chưa?"
        )
    else:
        return (
            "Xin chào! Tôi là interviewer hành vi hôm nay. "
            "Buổi phỏng vấn này sẽ bao gồm các câu hỏi về kinh nghiệm làm việc, "
            "kỹ năng mềm, và cách bạn handle các tình huống thực tế. "
            "Chúng tôi khuyến khuyến bạn sử dụng phương pháp STAR (Situation, Task, Action, Result) "
            "để trả lời câu hỏi — điều này giúp câu trả lời của bạn cấu trúc và dễ theo dõi hơn. "
            "Bạn có câu hỏi nào trước khi chúng ta bắt đầu không?"
        )


# =============================================================================
# Session Endpoints
# =============================================================================


@router.post("/sessions", response_model=SessionResponse)
async def create_interview_session(
    request: SessionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Create a new interview session.

    - **mode**: "technical" (system design, coding) or "behavioral" (STAR method)
    - **target_role**: Optional target job role for customization
    - **num_questions**: Number of questions (default: 5)

    Returns session with opening message from interviewer.
    """
    # Create session in database
    session = await create_session(
        user_id=current_user.id,
        mode=request.mode,
        target_role=request.target_role,
        num_questions=request.num_questions,
    )

    # Generate and save opening message
    greeting = _generate_greeting(request.mode, request.target_role)
    await create_message(
        session_id=session.id,
        role="assistant",
        content=greeting,
    )

    # Update session status
    await update_session(session.id, status="in_progress", question_count=0)

    # Fetch messages
    messages = await get_session_messages(session.id)

    return _session_to_response(session, messages)


@router.get("/sessions", response_model=list[SessionResponse])
async def get_interview_sessions(
    limit: int = 20,
    offset: int = 0,
    status: Literal["created", "in_progress", "completed", "abandoned"] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionResponse]:
    """List current user's interview sessions.

    - **limit**: Max results (default: 20)
    - **offset**: Pagination offset
    - **status**: Optional filter by status
    """
    sessions = await list_user_sessions(
        user_id=current_user.id,
        limit=limit,
        offset=offset,
        status=status,
    )

    return [_session_to_response(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_interview_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionResponse:
    """Get interview session details with all messages.

    User can only access their own sessions.
    """
    session = await get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Interview session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    messages = await get_session_messages(session_id)
    return _session_to_response(session, messages)


# =============================================================================
# Message Endpoints (with SSE Streaming - same pattern as chat.py)
# =============================================================================


@router.post("/sessions/{session_id}/messages", response_model=dict)
async def send_interview_message(
    session_id: uuid.UUID,
    body: MessageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send message in interview session (non-streaming).

    Returns both user and assistant messages.
    """
    session = await get_session(session_id)

    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "in_progress":
        raise HTTPException(
            status_code=400, detail=f"Cannot send message to {session.status} session"
        )

    # 1. Save user message
    user_msg = await create_message(
        session_id=session_id,
        role="user",
        content=body.content,
        original_audio_url=body.audio_url,
    )

    # 2. Update question count
    new_count = session.question_count + 1
    await update_session(session_id, question_count=new_count)

    # 3. Load recent history for context
    agent_messages = await _load_session_history(db, session_id)

    # 4. Build agent context
    profile_dict = _build_profile_dict(current_user)
    agent_ctx = AgentContext(profile=profile_dict)

    # 5. Call agent
    agent = get_interview_agent(mode=session.mode)  # type: ignore
    result = await agent.ainvoke(
        {"messages": agent_messages},
        context=agent_ctx,
    )

    # 6. Extract reply
    last_msg = result["messages"][-1]
    reply_text = last_msg.content if hasattr(last_msg, "content") else str(last_msg)

    # 7. Save assistant message
    bot_msg = await create_message(
        session_id=session_id,
        role="assistant",
        content=reply_text,
    )

    # 8. Update session timestamp
    await update_session(session_id, updated_at=func.now())

    return {
        "user_message": _message_to_response(user_msg),
        "assistant_message": _message_to_response(bot_msg),
    }


@router.post("/sessions/{session_id}/messages/stream")
async def send_interview_message_stream(
    session_id: uuid.UUID,
    body: MessageCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send message with SSE streaming (same pattern as chat.py).

    Returns Server-Sent Events stream:
    - type: "user_message" - User message data
    - type: "token" - Streaming tokens
    - type: "done" - Complete message data
    - type: "error" - Error message
    """
    session = await get_session(session_id)

    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.status != "in_progress":
        raise HTTPException(
            status_code=400, detail=f"Cannot send message to {session.status} session"
        )

    # 1. Save user message
    user_msg = await create_message(
        session_id=session_id,
        role="user",
        content=body.content,
        original_audio_url=body.audio_url,
    )

    # 2. Update question count
    new_count = session.question_count + 1
    await update_session(session_id, question_count=new_count)

    # 3. Load recent history
    agent_messages = await _load_session_history(db, session_id)

    # 4. Build agent context
    profile_dict = _build_profile_dict(current_user)
    agent_ctx = AgentContext(profile=profile_dict)

    uid = session_id if isinstance(session_id, uuid.UUID) else uuid.UUID(session_id)

    async def _token_generator():
        agent = get_interview_agent(mode=session.mode)  # type: ignore
        full_response = ""

        # Send user message data
        user_msg_data = {
            "type": "user_message",
            "id": str(user_msg.id),
            "session_id": str(user_msg.session_id),
            "role": user_msg.role,
            "content": user_msg.content,
            "created_at": user_msg.created_at.isoformat(),
        }
        yield f"data: {json.dumps(user_msg_data, ensure_ascii=False)}\n\n"

        try:
            # Stream tokens using LangChain astream (same pattern as chat.py)
            async for chunk in agent.astream(
                {"messages": agent_messages},
                context=agent_ctx,
                stream_mode="messages",
            ):
                msg, metadata = chunk
                if isinstance(msg, AIMessageChunk) and msg.content:
                    full_response += msg.content
                    yield f"data: {json.dumps({'type': 'token', 'content': msg.content}, ensure_ascii=False)}\n\n"

            # Save assistant message using a fresh DB session
            async with db_module.async_session_factory() as db_sess:
                bot_msg = db_module.interview.InterviewMessage(
                    session_id=uid,
                    role="assistant",
                    content=full_response,
                )
                db_sess.add(bot_msg)
                session_obj = await db_sess.get(
                    db_module.interview.InterviewSession, uid
                )
                if session_obj:
                    session_obj.updated_at = func.now()
                await db_sess.commit()
                await db_sess.refresh(bot_msg)

                done_payload = {
                    "type": "done",
                    "assistant_message": {
                        "id": str(bot_msg.id),
                        "session_id": str(bot_msg.session_id),
                        "role": bot_msg.role,
                        "content": bot_msg.content,
                        "created_at": bot_msg.created_at.isoformat(),
                    },
                }
                yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

        except Exception:
            logger.exception("Streaming error in session %s", session_id)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Lỗi khi tạo phản hồi'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        _token_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# =============================================================================
# Session Completion
# =============================================================================


@router.post("/sessions/{session_id}/complete", response_model=SessionSummaryResponse)
async def complete_interview_session(
    session_id: uuid.UUID,
    request: SessionCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SessionSummaryResponse:
    """Complete interview session and generate summary.

    Generates:
    - Overall score (1.0-5.0)
    - Overall feedback
    - Strengths and improvements lists
    - Actionable improvement plan

    Session status changes to "completed".
    """
    session = await get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Session already completed")

    # Get all messages
    messages = await get_session_messages(session_id)
    message_dicts = [{"role": m.role, "content": m.content} for m in messages]

    # Generate summary
    profile = _build_profile_dict(current_user)
    summary = await generate_session_summary(
        mode=session.mode,  # type: ignore
        messages=message_dicts,
        profile=profile,
        target_role=session.target_role or "Software Engineer",
        evaluations=None,  # TODO: Add evaluation integration
    )

    # Update session with summary
    await update_session(
        session_id,
        status="completed",
        overall_score=summary.overall_score,
        overall_feedback=summary.overall_feedback,
        improvement_plan=summary.improvement_plan,
    )

    return SessionSummaryResponse(
        session_id=session.id,
        mode=session.mode,  # type: ignore
        overall_score=summary.overall_score,
        overall_feedback=summary.overall_feedback,
        strengths=summary.strengths,
        improvements=summary.improvements,
        improvement_plan=summary.improvement_plan,
        question_count=summary.question_count,
        questions_breakdown=[],  # TODO: Add detailed breakdown
    )


# =============================================================================
# Session Deletion
# =============================================================================


@router.delete("/sessions/{session_id}")
async def delete_interview_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete interview session.

    User can only delete their own sessions.
    All messages in the session will be cascade deleted.
    """
    session = await get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete session (messages cascade delete)
    async with db as db_sess:
        await db_sess.delete(session)
        await db_sess.commit()

    return {"detail": "Session deleted successfully"}


# Export router for app/main.py
interview_router = router
