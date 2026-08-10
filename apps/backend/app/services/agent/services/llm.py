"""LLM factory — create ChatOpenAI from YAML config.

Root cause fix (2026-08-10): production pointed OPENAI_* at OpenRouter, whose
account ran out of credits → every agent LLM call (chat, insight, interview
eval) returned HTTP 402 → insight showed "Không tóm tắt được".

Mirrors jd_extract._effective(): prefer the JD_LLM_* provider (Zen free tier)
when configured, else fall back to OPENAI_*. Zen free tier rejects any
Authorization header (401), so when the effective base_url is Zen we inject
httpx transports that strip the header on both the sync and async paths —
ChatOpenAI always attaches `Bearer <key>` otherwise (the OpenAI SDK forbids an
empty api_key at construction).
"""

import os

import httpx
from langchain_openai import ChatOpenAI

from app.core import config as app_config
from app.services.agent.config import cfg

_ZEN_BASE_URL = "https://opencode.ai/zen"


class _StripAuthTransport(httpx.HTTPTransport):
    """Sync transport that drops the Authorization header before sending."""

    def handle_request(self, request):
        request.headers.pop("authorization", None)
        return super().handle_request(request)


class _StripAuthAsyncTransport(httpx.AsyncHTTPTransport):
    """Async transport that drops the Authorization header before sending."""

    async def handle_async_request(self, request):
        request.headers.pop("authorization", None)
        return await super().handle_async_request(request)


def create_llm() -> ChatOpenAI:
    llm_cfg = cfg["llm"]
    # Uu tien provider JD_LLM_* (Zen free tier) khi duoc cau hinh, roi xuong
    # OPENAI_* — giong jd_extract._effective(). OPENAI_* chi dung den khi het
    # hy vong: cfg["llm"] da resolve ${OPENAI_MODEL}/${OPENAI_BASE_URL} o import
    # time, chinh la noi OpenRouter (het credit) gan vao o production.
    jd_api_key = app_config.JD_LLM_API_KEY
    if jd_api_key:
        model = app_config.JD_LLM_MODEL
        base_url = app_config.JD_LLM_BASE_URL
        api_key = jd_api_key
    else:
        model = llm_cfg["model"]
        base_url = llm_cfg["base_url"]
        api_key = os.getenv("OPENAI_API_KEY", "")

    kwargs = dict(
        model=model,
        base_url=base_url,
        temperature=llm_cfg["temperature"],
        max_tokens=llm_cfg["max_tokens"],
    )
    # Chi truyen api_key khi CO gia tri. Voi openai SDK >=2, truyen chuoi rong
    # (moi truong thieu OPENAI_API_KEY — CI, may dev) bi loi ngay luc KHOI TAO:
    # "The api_key and workload_identity arguments are mutually exclusive".
    # Bo qua cho constructor tu lui ve doc env; luc THAT SU goi LLM moi loi, va
    # production luon co key nen khong doi hanh vi.
    if api_key:
        kwargs["api_key"] = api_key
    # Zen free tier (opencode.ai/zen) tu choi 401 neu co bat ky Authorization
    # header nao. ChatOpenAI luon gui `Bearer` khi co api_key (openai lib cap
    # len), nen chui qua transport strip header — duoc test ca sync + async.
    if base_url.startswith(_ZEN_BASE_URL):
        kwargs["http_client"] = httpx.Client(timeout=600, transport=_StripAuthTransport())
        kwargs["http_async_client"] = httpx.AsyncClient(timeout=600, transport=_StripAuthAsyncTransport())
    return ChatOpenAI(**kwargs)
