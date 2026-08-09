"""Extract insight tu JD text bang LLM."""
import json

import pytest
from unittest.mock import MagicMock

from app.core import config as app_config
from app.services.jd_extract import MODEL_VERSION, ExtractError, _call_llm, _auth_headers, extract_insight

GOOD_JSON = {
    "summary": {"role_summary": "Lam AI", "seniority_hint": "mid"},
    "skills": {"hard": ["Python"], "soft": [], "tools": ["Docker"], "languages": [], "certifications": []},
    "requirements": {"years_experience": {"min": 3, "max": None, "raw": "3 YOE+"},
                     "education": {"level": "university", "major": None},
                     "work_type": "fulltime", "remote": "hybrid", "other": []},
    "responsibilities": ["Xay model"], "benefits": ["Bao hiem"], "keywords": ["LLM"], "extras": [],
}


def _fake_resp(content: str, status: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status
    resp.json.return_value = {"choices": [{"message": {"content": content}}]}
    resp.text = content
    return resp


def _patch_httpx(monkeypatch, resp: MagicMock) -> MagicMock:
    client = MagicMock()
    client.post = MagicMock(return_value=resp)
    ctx = MagicMock()
    ctx.__enter__.return_value = client
    ctx.__exit__.return_value = None
    monkeypatch.setattr("app.services.jd_extract.httpx.Client", lambda **kw: ctx)
    return client


@pytest.mark.asyncio
async def test_extract_valid(monkeypatch):
    _patch_httpx(monkeypatch, _fake_resp(json.dumps(GOOD_JSON)))

    result = await extract_insight("Mô tả công việc...", source="topcv", source_job_id="1")
    assert isinstance(result, dict)  # dict de nhet vao jsonb
    assert result["skills"]["hard"] == ["Python"]
    assert result["job"]["source"] == "topcv"
    assert result["job"]["source_job_id"] == "1"


@pytest.mark.asyncio
async def test_extract_sai_json_raise(monkeypatch):
    _patch_httpx(monkeypatch, _fake_resp("khong phai json"))

    with pytest.raises(ExtractError):
        await extract_insight("text")


def test_model_version_fixed():
    assert MODEL_VERSION == "jdi-v1"


def test_auth_headers_zen_khong_gui_authorization():
    # Zen free: gui bat ky Authorization header nao cung bi 401
    assert _auth_headers("sk-zen", "https://opencode.ai/zen/v1") == {}


def test_auth_headers_openrouter_gui_bearer():
    assert _auth_headers("sk-or-xxx", "https://openrouter.ai/api/v1") == {
        "Authorization": "Bearer sk-or-xxx"
    }


def test_call_llm_dung_jd_llm_provider(monkeypatch):
    monkeypatch.setattr(app_config, "JD_LLM_API_KEY", "sk-zen")
    monkeypatch.setattr(app_config, "JD_LLM_BASE_URL", "https://opencode.ai/zen/v1")
    monkeypatch.setattr(app_config, "JD_LLM_MODEL", "deepseek-v4-flash-free")

    client = _patch_httpx(monkeypatch, _fake_resp(json.dumps({"summary": {"role_summary": "x"}})))
    out = _call_llm("text")
    assert out  # khong raise
    url = client.post.call_args.args[0]
    assert url == "https://opencode.ai/zen/v1/chat/completions"
    assert client.post.call_args.kwargs["headers"] == {}
    body = client.post.call_args.kwargs["json"]
    assert body["model"] == "deepseek-v4-flash-free"


def test_call_llm_fallback_openai_gui_bearer(monkeypatch):
    monkeypatch.setattr(app_config, "JD_LLM_API_KEY", "")
    monkeypatch.setattr(app_config, "OPENAI_API_KEY", "sk-fallback")
    monkeypatch.setattr(app_config, "OPENAI_BASE_URL", "http://fallback/v1")
    monkeypatch.setattr(app_config, "OPENAI_MODEL", "fallback-model")

    client = _patch_httpx(monkeypatch, _fake_resp(json.dumps({"summary": {"role_summary": "x"}})))
    _call_llm("text")
    assert client.post.call_args.kwargs["headers"] == {"Authorization": "Bearer sk-fallback"}
    assert client.post.call_args.kwargs["json"]["model"] == "fallback-model"


def test_call_llm_http_error_raise(monkeypatch):
    monkeypatch.setattr(app_config, "JD_LLM_API_KEY", "sk-or-xxx")
    monkeypatch.setattr(app_config, "JD_LLM_BASE_URL", "https://openrouter.ai/api/v1")
    _patch_httpx(monkeypatch, _fake_resp("out of credits", status=402))
    with pytest.raises(RuntimeError, match="402"):
        _call_llm("text")
