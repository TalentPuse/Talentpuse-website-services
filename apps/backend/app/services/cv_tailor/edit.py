"""Apply a natural-language edit to a user's stored CV model, then re-render.

The LLM only ever transforms the validated ResumeModel JSON — it never emits
LaTeX. The edit is confined to what the user asked; the prompt forbids inventing
employers, dates, degrees, or achievements not already present. Render/compile/
upload is delegated to the shared helpers in build.py."""
from __future__ import annotations

import asyncio
import json
import logging

from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cv_document import CvDocument
from app.services.cv_parser import truncate_cv_text
from app.services.cv_tailor.build import (
    CV_BUILD_LOCK_NAMESPACE,
    build_base_model_from_cv_text,
    compile_and_store,
    openai_json,
)
from app.services.cv_tailor.model import ResumeModel

logger = logging.getLogger(__name__)

_SYS = (
    "You edit a resume represented as JSON. You are given the current resume and a "
    "user instruction. Apply ONLY the requested change and keep every other field "
    "identical. You MUST NOT invent employers, job titles, dates, degrees, GPAs, or "
    "achievements that are not already present — unless the user's instruction explicitly "
    "supplies them (e.g. 'add skill Kubernetes'). Preserve the exact JSON schema of the "
    'input. Return JSON: {"resume": <full updated resume, same schema>, '
    '"change_summary": <one short Vietnamese sentence describing what changed>}.'
)


def _llm_edit(current: ResumeModel, instruction: str) -> tuple[ResumeModel, str]:
    payload = json.dumps(
        {"current_resume": current.model_dump(), "instruction": instruction},
        ensure_ascii=False,
    )
    data = openai_json(_SYS, payload)
    try:
        new_model = ResumeModel.model_validate(data["resume"])
    except (ValidationError, KeyError, TypeError) as e:
        raise RuntimeError(f"llm_edit_parse_error: {e}") from e
    summary = str(data.get("change_summary") or "Đã cập nhật CV.")
    return new_model, summary


async def apply_edit(db: AsyncSession, user, instruction: str) -> dict:
    """Load the user's CV model, apply the instruction via LLM, re-render+compile,
    persist. Raises ValueError('no_cv') if the user has neither a document nor
    cv_text to build from; RuntimeError on LLM/compile failure."""
    # Chup user_id ngay tu dau, TRUOC bat ky thao tac DB nao co the rollback ben
    # duoi - cung ly do nhu build.py:ensure_document (xem comment tai
    # CV_BUILD_LOCK_NAMESPACE): db.rollback() lam het han moi object ORM gan voi
    # session, ke ca `user`. Dung user_id (gia tri thuong, khong phai attribute
    # ORM) cho moi lan can id ve sau trong ham nay, tranh MissingGreenlet neu
    # nhanh IntegrityError ben duoi thuc su chay.
    user_id = user.id
    row = (await db.execute(
        select(CvDocument).where(CvDocument.user_id == user_id))).scalar_one_or_none()
    if row is None:
        if not user.cv_text:
            raise ValueError("no_cv")

        # Cung khoa + co che phuc hoi IntegrityError nhu build.py:ensure_document -
        # chan race giua tool edit_cv nay va GET /api/cv/document (ca hai co the
        # cung insert CvDocument row dau tien cho user chua tung co CV).
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:ns, hashtext(:uid))"),
            {"ns": CV_BUILD_LOCK_NAMESPACE, "uid": str(user_id)},
        )
        row = (await db.execute(
            select(CvDocument).where(CvDocument.user_id == user_id))).scalar_one_or_none()
        if row is None:
            base = await build_base_model_from_cv_text(truncate_cv_text(user.cv_text))
            row = CvDocument(user_id=user_id, model_json=base.model_dump())
            db.add(row)
            try:
                await db.flush()
            except IntegrityError:
                # Concurrent first-insert race: another request (GET /document or
                # another edit_cv call) already inserted the row. Discard ours and
                # reuse the winner instead of letting IntegrityError escape the
                # tool coroutine uncaught.
                await db.rollback()
                row = (await db.execute(
                    select(CvDocument).where(CvDocument.user_id == user_id))).scalar_one_or_none()
                if row is None:
                    raise

    current = ResumeModel.model_validate(row.model_json)
    new_model, summary = await asyncio.to_thread(_llm_edit, current, instruction)

    pdf_url, pages = await compile_and_store(user_id, new_model)
    row.model_json = new_model.model_dump()
    row.pdf_url = pdf_url
    row.page_count = pages
    await db.commit()
    return {
        "change_summary": summary,
        "model": row.model_json,
        "pdf_url": row.pdf_url,
        "page_count": row.page_count,
    }
