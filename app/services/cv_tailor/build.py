from __future__ import annotations
import asyncio, json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.models.cv_document import CvDocument
from app.services.cv_parser import upload_to_s3
from app.services.cv_tailor.model import ResumeModel
from app.services.cv_tailor.renderer import render_tex
from app.services.cv_tailor.compiler import compile_tex
from app.services.cv_tailor.validator import page_count

_SYS = ("Extract this CV into JSON with keys: header{full_name,email,phone,location,linkedin,github}, "
        "summary, education[], experience[{company,title,location,start,end,bullets[]}], "
        "projects[{name,url,date,tech[],bullets[]}], skills{technical[],languages[],tools[]}. "
        "Only use facts present in the CV. Return JSON only.")


def _llm_to_model(cv_text: str) -> ResumeModel:
    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    r = client.chat.completions.create(model=OPENAI_MODEL, temperature=0,
        response_format={"type": "json_object"}, timeout=120,
        messages=[{"role": "system", "content": _SYS}, {"role": "user", "content": cv_text}])
    return ResumeModel.model_validate(json.loads(r.choices[0].message.content))


async def build_base_model_from_cv_text(cv_text: str) -> ResumeModel:
    return await asyncio.to_thread(_llm_to_model, cv_text)


async def ensure_document(db: AsyncSession, user) -> dict:
    row = (await db.execute(
        select(CvDocument).where(CvDocument.user_id == user.id))).scalar_one_or_none()
    if row is None:
        if not user.cv_text:
            raise ValueError("no_cv_text")
        model = await build_base_model_from_cv_text(user.cv_text)
        res = await compile_tex(render_tex(model))
        if not res.ok:
            raise RuntimeError("compile_failed")
        pdf_url = await asyncio.to_thread(upload_to_s3, res.pdf, f"cv-pdf/{user.id}.pdf")
        row = CvDocument(user_id=user.id, model_json=model.model_dump(),
                         pdf_url=pdf_url, page_count=page_count(res.pdf))
        db.add(row)
        await db.commit()
    return {"model": row.model_json, "pdf_url": row.pdf_url, "page_count": row.page_count}
