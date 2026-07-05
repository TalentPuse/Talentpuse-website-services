"""Build a user's base CV document from their stored cv_text.

LLM output is confined to a Pydantic ResumeModel (JSON) — never raw LaTeX.
Deterministic rendering + Tectonic compile live in the shared helpers below,
reused by the edit pipeline."""
from __future__ import annotations
import asyncio, json, logging

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.models.cv_document import CvDocument
from app.services.cv_parser import upload_to_s3
from app.services.cv_tailor.compiler import compile_tex
from app.services.cv_tailor.model import ResumeModel
from app.services.cv_tailor.renderer import render_tex
from app.services.cv_tailor.validator import page_count

logger = logging.getLogger(__name__)

_SYS = (
    "Extract this CV into JSON with keys: "
    "header{full_name,email,phone,location,linkedin,github}, "
    "summary, "
    "education[{institution,degree,field,start,end,gpa,highlights[]}], "
    "experience[{company,title,location,start,end,bullets[]}] "
    "(location = work type/city e.g. Remote/Full-time/HCMC), "
    "projects[{name,role,date,description,bullets[],achievement,links[{label,url}]}], "
    "skills[{category,items[]}] "
    "(group into categories such as Programming, AI & Agents, Databases, Core ML, "
    "Software Development, Cloud & Tools — keep the CV's own grouping if it has one), "
    "honors[] (award/achievement strings), "
    "certifications[{title,issuer,date,bullets[]}]. "
    "Only use facts present in the CV. Do not invent anything. Return JSON only."
)


# ─── Shared LLM + render helpers (reused by build + edit) ───────────────

def openai_json(system: str, user_content: str) -> dict:
    """One OpenAI JSON-mode call. Raises RuntimeError on empty/invalid output."""
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    r = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        timeout=120,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
    )
    content = r.choices[0].message.content
    if not content:
        raise RuntimeError("llm_empty_response")
    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"llm_parse_error: {e}") from e


async def render_and_compile(model: ResumeModel) -> bytes:
    """Render + Tectonic-compile a model to PDF bytes. RuntimeError on failure."""
    res = await compile_tex(render_tex(model))
    if not res.ok or res.pdf is None:
        logger.error("CV compile failed: %s", (res.log or "")[:500])
        raise RuntimeError("compile_failed")
    return res.pdf


async def compile_and_store(user, model: ResumeModel) -> tuple[str | None, int]:
    """Render+compile, upload the PDF to storage, return (pdf_url, page_count)."""
    pdf = await render_and_compile(model)
    pdf_url = await asyncio.to_thread(upload_to_s3, pdf, f"cv-pdf/{user.id}.pdf")
    return pdf_url, page_count(pdf)


# ─── Base-model extraction from cv_text ─────────────────────────────────

def _llm_to_model(cv_text: str) -> ResumeModel:
    try:
        return ResumeModel.model_validate(openai_json(_SYS, cv_text))
    except ValidationError as e:
        raise RuntimeError(f"llm_parse_error: {e}") from e


async def build_base_model_from_cv_text(cv_text: str) -> ResumeModel:
    return await asyncio.to_thread(_llm_to_model, cv_text)


async def ensure_document(db: AsyncSession, user) -> dict:
    row = (await db.execute(
        select(CvDocument).where(CvDocument.user_id == user.id))).scalar_one_or_none()
    if row is None:
        if not user.cv_text:
            raise ValueError("no_cv_text")
        model = await build_base_model_from_cv_text(user.cv_text)
        pdf_url, pages = await compile_and_store(user, model)
        row = CvDocument(user_id=user.id, model_json=model.model_dump(),
                         pdf_url=pdf_url, page_count=pages)
        db.add(row)
        try:
            await db.commit()
        except IntegrityError:
            # Concurrent first-render race: another request already inserted the
            # row. Discard ours and reuse the winner instead of 500-ing.
            await db.rollback()
            row = (await db.execute(
                select(CvDocument).where(CvDocument.user_id == user.id))).scalar_one_or_none()
            if row is None:
                raise
    return {"model": row.model_json, "pdf_url": row.pdf_url, "page_count": row.page_count}


async def render_pdf_bytes(db: AsyncSession, user) -> bytes:
    """Deterministically re-render the stored model to PDF bytes. Fallback for the
    /pdf proxy when the pre-rendered PDF isn't in storage. Requires the row."""
    row = (await db.execute(
        select(CvDocument).where(CvDocument.user_id == user.id))).scalar_one_or_none()
    if row is None:
        raise ValueError("no_document")
    return await render_and_compile(ResumeModel.model_validate(row.model_json))
