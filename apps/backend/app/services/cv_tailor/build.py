"""Build a user's base CV document from their stored cv_text.

LLM output is confined to a Pydantic ResumeModel (JSON) — never raw LaTeX.
Deterministic rendering + Tectonic compile live in the shared helpers below,
reused by the edit pipeline."""
from __future__ import annotations

import asyncio
import json
import logging

from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.models.cv_document import CvDocument
from app.services.cv_parser import truncate_cv_text, upload_to_s3
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


async def compile_and_store(user_id, model: ResumeModel) -> tuple[str | None, int]:
    """Render+compile, upload the PDF to storage, return (pdf_url, page_count).

    Takes user_id (not the `user` ORM object) on purpose: callers that recover
    from a concurrent-insert IntegrityError via db.rollback() have an EXPIRED
    `user` at that point (rollback expires every object on the session) --
    touching `user.id` there raises MissingGreenlet (see the comment on
    CV_BUILD_LOCK_NAMESPACE below). A plain id captured before any DB write
    sidesteps that entirely.
    """
    pdf = await render_and_compile(model)
    pdf_url = await asyncio.to_thread(upload_to_s3, pdf, f"cv-pdf/{user_id}.pdf")
    return pdf_url, page_count(pdf)


# ─── Base-model extraction from cv_text ─────────────────────────────────

def _llm_to_model(cv_text: str) -> ResumeModel:
    try:
        return ResumeModel.model_validate(openai_json(_SYS, cv_text))
    except ValidationError as e:
        raise RuntimeError(f"llm_parse_error: {e}") from e


async def build_base_model_from_cv_text(cv_text: str) -> ResumeModel:
    return await asyncio.to_thread(_llm_to_model, cv_text)


# Khoa 2-so-nguyen (namespace, hash(user_id)) khac khong-gian voi khoa 1-so-nguyen
# ALERT_DISPATCH_LOCK_ID trong job_alert.py nen khong dung nhau duoc (PG dam bao
# 2 kieu khoa nay khong bao gio va cham). Gia tri namespace la tuy y, chi can co
# dinh va khong trung voi khoa khac trong repo.
CV_BUILD_LOCK_NAMESPACE = 918_273_645


async def ensure_document(db: AsyncSession, user) -> dict:
    # Chup user_id ngay tu dau, KHONG dung lai user.id sau buoc rollback ben duoi:
    # AsyncSession.rollback() lam HET HAN moi object ORM gan voi session nay - ke
    # ca `user` (cung duoc load qua Depends(get_db) trong get_current_user). Dong
    # vao thuoc tinh da het han trong async session se nem MissingGreenlet (loi ha
    # tang, khong phai loi nghiep vu) -> FastAPI tra HTTP 500 plain text, frontend
    # khong parse duoc JSON.
    user_id = user.id
    row = (await db.execute(
        select(CvDocument).where(CvDocument.user_id == user_id))).scalar_one_or_none()
    if row is None:
        if not user.cv_text:
            raise ValueError("no_cv_text")

        # Khoa quanh buoc build (theo user_id) de nhieu request GET /api/cv/document
        # goi song song khong con cung build -> insert trung -> IntegrityError -> 502
        # cho nguoi thua cuoc. Cung kieu voi pg_try_advisory_lock trong
        # app/services/job_alert.py, nhung dung ban pg_advisory_xact_lock (tu nha khi
        # transaction commit/rollback) thay vi ban session: request build CV co the
        # chet giua chung (LLM/Tectonic timeout), ban xact tranh ro ri khoa ma khong
        # can code unlock thu cong o finally. Nguoi den sau CHO (block) ngay tai day
        # toi khi nguoi dau tien commit/rollback xong roi doc lai row thay vi build
        # them lan nua -> khong con 502 vi race.
        await db.execute(
            text("SELECT pg_advisory_xact_lock(:ns, hashtext(:uid))"),
            {"ns": CV_BUILD_LOCK_NAMESPACE, "uid": str(user_id)},
        )
        row = (await db.execute(
            select(CvDocument).where(CvDocument.user_id == user_id))).scalar_one_or_none()
        if row is None:
            model = await build_base_model_from_cv_text(truncate_cv_text(user.cv_text))
            pdf_url, pages = await compile_and_store(user_id, model)
            row = CvDocument(user_id=user_id, model_json=model.model_dump(),
                             pdf_url=pdf_url, page_count=pages)
            db.add(row)
            try:
                await db.commit()
            except IntegrityError:
                # Concurrent first-render race: another request already inserted the
                # row. Discard ours and reuse the winner instead of 500-ing.
                await db.rollback()
                row = (await db.execute(
                    select(CvDocument).where(CvDocument.user_id == user_id))).scalar_one_or_none()
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
