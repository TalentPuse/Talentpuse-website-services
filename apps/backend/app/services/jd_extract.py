"""Extract insight tu JD text bang LLM (OpenRouter qua OPENAI_API_KEY)."""
from __future__ import annotations

import asyncio
import json
import logging

from openai import OpenAI

from app.core.config import OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
from app.schemas.jd_insight import JdInsight

logger = logging.getLogger(__name__)

MODEL_VERSION = "jdi-v1"

_chat: OpenAI | None = None


def _get_chat() -> OpenAI:
    global _chat
    if _chat is None:
        _chat = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    return _chat


class ExtractError(RuntimeError):
    pass


_PROMPT = """\
Ban trich xuat du lieu co cau truc tu noi dung tin tuyen dung (JD) tieng Viet/Anh.
Tra VE JSON DUNG SCHEMA sau (khong them giai thich):

{
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
"""


def _call_llm(text: str) -> str:
    """Sync goi OpenAI (chay trong thread) — tra raw content tu LLM."""
    client = _get_chat()
    resp = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        timeout=120,
        messages=[
            {"role": "system", "content": _PROMPT},
            {"role": "user", "content": text[:8000]},
        ],
    )
    return (resp.choices[0].message.content or "").strip()


async def extract_insight(text: str) -> dict:
    """Goi LLM extract JD text -> dict JSON da validate theo JdInsight."""
    try:
        content = await asyncio.to_thread(_call_llm, text[:8000])
        data = json.loads(content)
    except Exception as exc:
        raise ExtractError(f"llm_extract_failed: {exc}") from exc
    try:
        return JdInsight.model_validate(data).model_dump(mode="json")
    except Exception as exc:
        raise ExtractError(f"llm_parse_error: {exc}") from exc
