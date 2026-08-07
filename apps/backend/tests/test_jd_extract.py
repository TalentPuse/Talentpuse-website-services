"""Extract insight tu JD text bang LLM."""
import json

import pytest
from unittest.mock import MagicMock

from app.services.jd_extract import MODEL_VERSION, ExtractError, extract_insight

GOOD_JSON = {
    "summary": {"role_summary": "Lam AI", "seniority_hint": "mid"},
    "skills": {"hard": ["Python"], "soft": [], "tools": ["Docker"], "languages": [], "certifications": []},
    "requirements": {"years_experience": {"min": 3, "max": None, "raw": "3 YOE+"},
                     "education": {"level": "university", "major": None},
                     "work_type": "fulltime", "remote": "hybrid", "other": []},
    "responsibilities": ["Xay model"], "benefits": ["Bao hiem"], "keywords": ["LLM"], "extras": [],
}


@pytest.mark.asyncio
async def test_extract_valid(monkeypatch):
    fake = MagicMock()
    fake.choices[0].message.content = json.dumps(GOOD_JSON)
    fake_chat = MagicMock()
    fake_chat.chat.completions.create = MagicMock(return_value=fake)
    monkeypatch.setattr("app.services.jd_extract._chat", fake_chat)

    result = await extract_insight("Mô tả công việc...", source="topcv", source_job_id="1")
    assert isinstance(result, dict)  # dict de nhet vao jsonb
    assert result["skills"]["hard"] == ["Python"]
    assert result["job"]["source"] == "topcv"
    assert result["job"]["source_job_id"] == "1"


@pytest.mark.asyncio
async def test_extract_sai_json_raise(monkeypatch):
    fake = MagicMock()
    fake.choices[0].message.content = "khong phai json"
    fake_chat = MagicMock()
    fake_chat.chat.completions.create = MagicMock(return_value=fake)
    monkeypatch.setattr("app.services.jd_extract._chat", fake_chat)

    with pytest.raises(ExtractError):
        await extract_insight("text")


def test_model_version_fixed():
    assert MODEL_VERSION == "jdi-v1"
