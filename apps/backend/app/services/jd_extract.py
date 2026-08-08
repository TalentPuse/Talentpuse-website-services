"""Extract insight tu JD text bang LLM (OpenRouter qua OPENAI_API_KEY)."""
from __future__ import annotations

import asyncio
import json
import logging

from openai import OpenAI

from app.core import config
from app.schemas.jd_insight import JdInsight

logger = logging.getLogger(__name__)

MODEL_VERSION = "jdi-v1"

_chat: OpenAI | None = None


def _effective() -> tuple[str, str, str]:
    """(api_key, base_url, model) — uu tien provider JD_LLM_*, roi xuong OPENAI_*."""
    if config.JD_LLM_API_KEY:
        return config.JD_LLM_API_KEY, config.JD_LLM_BASE_URL, config.JD_LLM_MODEL
    return config.OPENAI_API_KEY, config.OPENAI_BASE_URL, config.OPENAI_MODEL


def _get_chat() -> OpenAI:
    global _chat
    if _chat is None:
        api_key, base_url, _ = _effective()
        _chat = OpenAI(api_key=api_key, base_url=base_url)
    return _chat


class ExtractError(RuntimeError):
    pass


_PROMPT = """\
Ban trich xuat du lieu co cau truc tu noi dung tin tuyen dung (JD) tieng Viet/Anh.
Tra VE JSON DUNG SCHEMA sau (khong them giai thich):

{
  "job": {"title": "tu tieu de", "company_name": "...", "job_level": "...", "job_category": "...",
          "city_canonical": "..."},
  "summary": {"role_summary": "1-2 cau", "seniority_hint": "intern|fresher|junior|mid|senior|lead|manager|null"},
  "skills": {"hard": ["ky nang ky thuat"], "soft": ["ky nang mem"], "tools": ["cong cu/framework"],
             "languages": [{"lang": "Tieng Nhat", "level": "N2"}], "certifications": ["AWS Certified"]},
  "requirements": {"years_experience": {"min": 3, "max": null, "raw": "cau goc"},
                   "education": {"level": "university|college|none|null", "major": null},
                   "work_type": "fulltime|contract|internship|parttime|null",
                   "remote": "remote|hybrid|onsite|null",
                   "other": ["yeu cau dac thu khong thuoc enum"]},
  "responsibilities": ["3-6 trach nhiem chinh, giu nguyen van"],
  "benefits": ["phuc loi, chuan hoa nhom: bao hiem, thuong thang 13..."],
  "keywords": ["tu khoa dac thu nganh"],
  "extras": [{"aspect": "deadline", "value": "nguyen van"}]  // toi da 10; chi nhat thu NGOAI cac field tren
}

Quy tac:
- KHONG bo sung giong/ky nang khong co trong JD
- skills: lowercase; "ai" khong doi thanh "artificial intelligence" (giu nguyen, synonym o lop aggregate)
- extras.aspect: snake_case lowercase (deadline, working_hours, probation, team_size, report_to, salary_note, location_detail...)
- extras toi da 10 items
- Salary trong JD chi duoc ghi vao extras voi aspect "salary_note", KHONG co field salary rieng
- job.source/source_job_id do he thong dien, KHONG tra trong JSON
"""


def _call_llm(text: str, *, json_mode: bool = True) -> str:
    """Sync goi OpenAI (chay trong thread) — tra raw content tu LLM."""
    client = _get_chat()
    _, _, model = _effective()
    kwargs = {
        "model": model,
        "temperature": 0,
        "timeout": 600,
        "messages": [
            {"role": "system", "content": _PROMPT},
            {"role": "user", "content": text},
        ],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    resp = client.chat.completions.create(**kwargs)
    return (resp.choices[0].message.content or "").strip()


async def extract_insight(
    text: str, source: str | None = None, source_job_id: str | None = None
) -> dict:
    """Goi LLM extract JD text -> dict JSON da validate theo JdInsight.

    source/source_job_id la metadata DB, merge vao job sau khi LLM tra ve.
    """
    try:
        try:
            content = await asyncio.to_thread(_call_llm, text[:8000])
        except Exception:
            logger.warning("json_mode call failed, retry khong response_format", exc_info=True)
            content = await asyncio.to_thread(_call_llm, text[:8000], json_mode=False)
        data = json.loads(content)
    except Exception as exc:
        raise ExtractError(f"llm_extract_failed: {exc}") from exc
    try:
        job = data.setdefault("job", {})
        if source is not None:
            job["source"] = source
        if source_job_id is not None:
            job["source_job_id"] = source_job_id
        return JdInsight.model_validate(data).model_dump(mode="json")
    except Exception as exc:
        raise ExtractError(f"llm_parse_error: {exc}") from exc
