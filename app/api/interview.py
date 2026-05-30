from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.interview import InterviewAnswer, InterviewQuestion, InterviewSession
from app.models.user import User
from app.schemas.interview import (
    AnswerSubmit,
    CategoryOut,
    QuestionOut,
    SessionCreate,
    SessionDetailOut,
    SessionOut,
)

router = APIRouter(prefix="/api/interview", tags=["interview"])


# ── Helpers ─────────────────────────────────────────────────


def _question_out(q: InterviewQuestion) -> QuestionOut:
    return QuestionOut(
        id=str(q.id),
        text=q.text,
        category=q.category,
        difficulty=q.difficulty,
        answer_tips=q.answer_tips,
        star_cues=q.star_cues,
    )


def _session_out(s: InterviewSession) -> SessionOut:
    return SessionOut(
        id=str(s.id),
        mode=s.mode,
        status=s.status,
        category=s.category,
        target_role=s.target_role,
        total_questions=s.total_questions,
        completed_questions=s.completed_questions,
        overall_score=s.overall_score,
        overall_feedback=s.overall_feedback,
        improvement_plan=s.improvement_plan,
        time_limit_seconds=s.time_limit_seconds,
        started_at=s.started_at,
        completed_at=s.completed_at,
        created_at=s.created_at,
    )


async def _load_session_with_answers(
    db: AsyncSession, session_id: uuid.UUID, user_id: uuid.UUID
) -> InterviewSession:
    session = await db.get(InterviewSession, session_id)
    if not session or session.user_id != user_id:
        raise HTTPException(404, "Session not found")
    return session


async def _build_session_detail(
    db: AsyncSession, session: InterviewSession
) -> SessionDetailOut:
    result = await db.execute(
        select(InterviewAnswer)
        .where(InterviewAnswer.session_id == session.id)
        .order_by(InterviewAnswer.order_index)
    )
    answers = result.scalars().all()

    answer_outs = []
    for a in answers:
        q_obj = await db.get(InterviewQuestion, a.question_id)
        answer_outs.append(
            SessionDetailOut.model_fields["answers"].annotation.__args__[0](
                id=str(a.id),
                question=_question_out(q_obj),
                order_index=a.order_index,
                answer_text=a.answer_text,
                score=a.score,
                strengths=a.strengths,
                improvements=a.improvements,
                suggested_answer=a.suggested_answer,
                time_spent_seconds=a.time_spent_seconds,
                skipped=a.skipped,
                answered_at=a.answered_at,
            )
        )

    return SessionDetailOut(
        **_session_out(session).model_dump(),
        answers=answer_outs,
    )


# ── Categories ──────────────────────────────────────────────


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            InterviewQuestion.category,
            func.count(InterviewQuestion.id).label("count"),
        )
        .where(InterviewQuestion.is_active == True)
        .group_by(InterviewQuestion.category)
    )
    results = rows.all()

    label_map = {
        "leadership": ("Leadership", "Lanh dao", "Cau hoi ve kha nang dan dat, ra quyet dinh, va inspire team"),
        "teamwork": ("Teamwork", "Lam viec nhom", "Cau hoi ve collaboration, conflict resolution trong team"),
        "problem_solving": ("Problem Solving", "Giai quyet van de", "Cau hoi ve tu duy phan tich, cach tiep can van de phuc tap"),
        "communication": ("Communication", "Giao tiep", "Cau hoi ve presentation, thuyet phuc, giai thich technical"),
        "adaptability": ("Adaptability", "Thich ung", "Cau hoi ve xu ly thay doi, ambiguity, hoc nhanh"),
        "conflict_resolution": ("Conflict Resolution", "Xu ly xung dot", "Cau hoi ve xu ly bat dong, negotiate, diplomacy"),
        "time_management": ("Time Management", "Quan ly thoi gian", "Cau hoi ve prioritize, deadline pressure, multitasking"),
    }

    cats = []
    for cat_id, count in results:
        label, label_vi, desc = label_map.get(cat_id, (cat_id, cat_id, ""))
        cats.append(CategoryOut(id=cat_id, label=label, label_vi=label_vi, description=desc, count=count))
    return cats


# ── Questions ───────────────────────────────────────────────


@router.get("/questions", response_model=list[QuestionOut])
async def list_questions(
    category: str | None = None,
    count: int = 5,
    db: AsyncSession = Depends(get_db),
):
    q = select(InterviewQuestion).where(InterviewQuestion.is_active == True)
    if category:
        q = q.where(InterviewQuestion.category == category)
    q = q.order_by(func.random()).limit(min(count, 20))

    rows = await db.execute(q)
    questions = rows.scalars().all()
    return [_question_out(q) for q in questions]


# ── Sessions ────────────────────────────────────────────────


@router.post("/sessions", response_model=SessionDetailOut, status_code=201)
async def create_session(
    body: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(InterviewQuestion).where(InterviewQuestion.is_active == True)
    if body.mode == "practice" and body.category:
        q = q.where(InterviewQuestion.category == body.category)
    q = q.order_by(func.random()).limit(body.num_questions)

    rows = await db.execute(q)
    questions = list(rows.scalars().all())

    if not questions:
        raise HTTPException(400, "No questions available for this criteria")

    session = InterviewSession(
        user_id=current_user.id,
        mode=body.mode,
        category=body.category if body.mode == "practice" else None,
        target_role=body.target_role if body.mode == "mock_test" else None,
        total_questions=len(questions),
        time_limit_seconds=body.time_limit_seconds if body.mode == "mock_test" else None,
    )
    db.add(session)
    await db.flush()

    for i, question in enumerate(questions):
        answer = InterviewAnswer(
            session_id=session.id,
            question_id=question.id,
            order_index=i,
        )
        db.add(answer)

    await db.commit()
    await db.refresh(session)
    return await _build_session_detail(db, session)


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.created_at.desc())
    )
    sessions = rows.scalars().all()
    return [_session_out(s) for s in sessions]


@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session_with_answers(db, uuid.UUID(session_id), current_user.id)
    return await _build_session_detail(db, session)


@router.delete("/sessions/{session_id}", status_code=204)
async def abandon_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session_with_answers(db, uuid.UUID(session_id), current_user.id)
    session.status = "abandoned"
    await db.commit()


# ── Answer submission ───────────────────────────────────────


@router.post("/sessions/{session_id}/answers/{answer_id}")
async def submit_answer(
    session_id: str,
    answer_id: str,
    body: AnswerSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session_with_answers(db, uuid.UUID(session_id), current_user.id)
    if session.status != "in_progress":
        raise HTTPException(400, "Session is not in progress")

    answer = await db.get(InterviewAnswer, uuid.UUID(answer_id))
    if not answer or answer.session_id != session.id:
        raise HTTPException(404, "Answer not found")

    if answer.answered_at or answer.skipped:
        raise HTTPException(400, "Already answered or skipped")

    answer.answer_text = body.answer_text
    answer.time_spent_seconds = body.time_spent_seconds
    answer.answered_at = func.now()

    session.completed_questions += 1

    # Auto-complete if all questions answered
    if session.completed_questions >= session.total_questions:
        session.status = "completed"
        session.completed_at = func.now()

    await db.commit()

    return {"status": "saved", "session_status": session.status}


@router.post("/sessions/{session_id}/answers/{answer_id}/skip", status_code=200)
async def skip_answer(
    session_id: str,
    answer_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session_with_answers(db, uuid.UUID(session_id), current_user.id)
    if session.mode != "practice":
        raise HTTPException(400, "Skip is only allowed in practice mode")

    answer = await db.get(InterviewAnswer, uuid.UUID(answer_id))
    if not answer or answer.session_id != session.id:
        raise HTTPException(404, "Answer not found")

    if answer.answered_at or answer.skipped:
        raise HTTPException(400, "Already answered or skipped")

    answer.skipped = True
    session.completed_questions += 1

    if session.completed_questions >= session.total_questions:
        session.status = "completed"
        session.completed_at = func.now()

    await db.commit()

    return {"status": "skipped", "session_status": session.status}


# ── Complete ────────────────────────────────────────────────


@router.post("/sessions/{session_id}/complete")
async def complete_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _load_session_with_answers(db, uuid.UUID(session_id), current_user.id)
    if session.status != "in_progress":
        raise HTTPException(400, "Session is not in progress")

    session.status = "completed"
    session.completed_at = func.now()
    await db.commit()

    return await _build_session_detail(db, session)
