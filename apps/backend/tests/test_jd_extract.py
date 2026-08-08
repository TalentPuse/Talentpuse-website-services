"""Extract insight tu JD text bang LLM."""
import json

import pytest
from unittest.mock import MagicMock

from app.core import config as app_config
from app.services.jd_extract import MODEL_VERSION, ExtractError, _call_llm, _get_chat, extract_insight

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


def test_default_dung_openai_khi_chua_set_jd_llm(monkeypatch):
    monkeypatch.setattr(app_config, "JD_LLM_API_KEY", "")
    monkeypatch.setattr(app_config, "OPENAI_API_KEY", "sk-fallback")
    monkeypatch.setattr(app_config, "OPENAI_BASE_URL", "http://fallback/v1")
    monkeypatch.setattr(app_config, "OPENAI_MODEL", "fallback-model")
    monkeypatch.setattr("app.services.jd_extract._chat", None)

    fake_client = MagicMock()
    fake_resp = MagicMock()
    fake_resp.choices[0].message.content = json.dumps({"summary": {"role_summary": "x"}})
    fake_client.chat.completions.create = MagicMock(return_value=fake_resp)
    monkeypatch.setattr("app.services.jd_extract.OpenAI", MagicMock(return_value=fake_client))

    client = _get_chat()
    assert client is fake_client
    called = _call_llm("text")
    assert called  # khong raise — dang ky thuong qua fallback
    _, kwargs = fake_client.chat.completions.create.call_args
    assert kwargs["model"] == "fallback-model"


def test_jd_llm_provider_override_zen(monkeypatch):
    monkeypatch.setattr(app_config, "JD_LLM_API_KEY", "sk-zen")
    monkeypatch.setattr(app_config, "JD_LLM_BASE_URL", "https://opencode.ai/zen/v1")
    monkeypatch.setattr(app_config, "JD_LLM_MODEL", "deepseek-v4-flash-free")
    monkeypatch.setattr("app.services.jd_extract._chat", None)

    fake_client = MagicMock()
    fake_resp = MagicMock()
    fake_resp.choices[0].message.content = json.dumps({"summary": {"role_summary": "x"}})
    fake_client.chat.completions.create = MagicMock(return_value=fake_resp)
    mock_openai = MagicMock(return_value=fake_client)
    monkeypatch.setattr("app.services.jd_extract.OpenAI", mock_openai)

    _get_chat()
    assert mock_openai.call_args.kwargs["base_url"] == "https://opencode.ai/zen/v1"
    assert mock_openai.call_args.kwargs["api_key"] == "sk-zen"

    _call_llm("text")
    _, kwargs = fake_client.chat.completions.create.call_args
    assert kwargs["model"] == "deepseek-v4-flash-free"
