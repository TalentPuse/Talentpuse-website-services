"""Tests for LLM factory."""
from __future__ import annotations

from unittest.mock import patch, MagicMock

import pytest


class TestCreateLlm:

    def test_create_llm_from_config(self):
        mock_cfg = {
            "llm": {
                "model": "deepseek/deepseek-v4-flash",
                "base_url": "https://api.openai.com/v1",
                "temperature": 0.7,
                "max_tokens": 2048,
            }
        }

        with patch("app.services.agent.services.llm.cfg", mock_cfg), \
             patch("app.services.agent.services.llm.os.getenv", return_value="test-key"):
            from app.services.agent.services.llm import create_llm

            llm = create_llm()

        assert llm.model_name == "deepseek/deepseek-v4-flash"

    def test_create_llm_custom_params(self):
        mock_cfg = {
            "llm": {
                "model": "gpt-4o",
                "base_url": "http://localhost:11434/v1",
                "temperature": 0.3,
                "max_tokens": 4096,
            }
        }

        with patch("app.services.agent.services.llm.cfg", mock_cfg), \
             patch("app.services.agent.services.llm.os.getenv", return_value="test-key"):
            from app.services.agent.services.llm import create_llm

            llm = create_llm()

        assert llm.model_name == "gpt-4o"
