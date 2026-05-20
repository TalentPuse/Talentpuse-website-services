"""LLM factory — create ChatOpenAI from YAML config."""

import os

from langchain_openai import ChatOpenAI

from app.services.agent.config import cfg


def create_llm() -> ChatOpenAI:
    llm_cfg = cfg["llm"]
    return ChatOpenAI(
        model=llm_cfg["model"],
        base_url=llm_cfg["base_url"],
        api_key=os.getenv("OPENAI_API_KEY", ""),
        temperature=llm_cfg["temperature"],
        max_tokens=llm_cfg["max_tokens"],
    )
