"""Apply a natural-language edit to a user's stored CV model, then re-render.

The LLM only ever transforms the validated ResumeModel JSON — it never emits
LaTeX. The edit is confined to what the user asked; the prompt forbids inventing
employers, dates, degrees, or achievements not already present."""
from __future__ import annotations
import asyncio
import json
import logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.models.cv_document import CvDocument
from app.services.cv_parser import upload_to_s3
from app.services.cv_tailor.build import build_base_model_from_cv_text
from app.services.cv_tailor.compiler import compile_tex
from app.services.cv_tailor.model import ResumeModel
from app.services.cv_tailor.renderer import render_tex
from app.services.cv_tailor.validator import page_count

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
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    payload = {"current_resume": current.model_dump(), "instruction": instruction}
    r = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        timeout=120,
        messages=[
            {"role": "system", "content": _SYS},
            {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
        ],
    )
    content = r.choices[0].message.content
    if not content:
        raise RuntimeError("llm_empty_response")
    try:
        data = json.loads(content)
        new_model = ResumeModel.model_validate(data["resume"])
    except (json.JSONDecodeError, ValidationError, KeyError, TypeError) as e:
        raise RuntimeError(f"llm_edit_parse_error: {e}") from e
    summary = str(data.get("change_summary") or "Đã cập nhật CV.")
    return new_model, summary


async def apply_edit(db: AsyncSession, user, instruction: str) -> dict:
    """Load the user's CV model, apply the instruction via LLM, re-render+compile,
    persist. Raises ValueError('no_cv') if the user has neither a document nor
    cv_text to build from; RuntimeError on LLM/compile failure."""
    row = (await db.execute(
        select(CvDocument).where(CvDocument.user_id == user.id))).scalar_one_or_none()
    if row is None:
        if not user.cv_text:
            raise ValueError("no_cv")
        base = await build_base_model_from_cv_text(user.cv_text)
        row = CvDocument(user_id=user.id, model_json=base.model_dump())
        db.add(row)
        await db.flush()

    current = ResumeModel.model_validate(row.model_json)
    new_model, summary = await asyncio.to_thread(_llm_edit, current, instruction)

    res = await compile_tex(render_tex(new_model))
    if not res.ok or res.pdf is None:
        logger.error("CV edit compile failed for user %s: %s", user.id, (res.log or "")[:500])
        raise RuntimeError("compile_failed")

    pdf_url = await asyncio.to_thread(upload_to_s3, res.pdf, f"cv-pdf/{user.id}.pdf")
    row.model_json = new_model.model_dump()
    row.pdf_url = pdf_url
    row.page_count = page_count(res.pdf)
    await db.commit()
    return {
        "change_summary": summary,
        "model": row.model_json,
        "pdf_url": row.pdf_url,
        "page_count": row.page_count,
    }
