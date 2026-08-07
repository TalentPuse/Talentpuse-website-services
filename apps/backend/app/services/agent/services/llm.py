"""LLM factory — create ChatOpenAI from YAML config."""

import os

from langchain_openai import ChatOpenAI

from app.services.agent.config import cfg


def create_llm() -> ChatOpenAI:
    llm_cfg = cfg["llm"]
    kwargs = dict(
        model=llm_cfg["model"],
        base_url=llm_cfg["base_url"],
        temperature=llm_cfg["temperature"],
        max_tokens=llm_cfg["max_tokens"],
    )
    # Chi truyen api_key khi CO gia tri. Voi openai SDK >=2, truyen chuoi rong
    # (moi truong thieu OPENAI_API_KEY — CI, may dev) bi loi ngay luc KHOI TAO:
    # "The api_key and workload_identity arguments are mutually exclusive".
    # Bo qua cho constructor tu lui ve doc env; luc THAT SU goi LLM moi loi, va
    # production luon co key nen khong doi hanh vi.
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        kwargs["api_key"] = api_key
    return ChatOpenAI(**kwargs)
