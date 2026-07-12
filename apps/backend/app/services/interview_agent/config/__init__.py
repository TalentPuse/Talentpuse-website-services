"""Load interview agent config from YAML, resolve ${ENV_VAR} references."""

import os
import re
from functools import lru_cache
from pathlib import Path

import yaml

_CONFIG_PATH = Path(__file__).parent / "interview_agent.yaml"


@lru_cache
def load_config() -> dict:
    """Load interview agent configuration with environment variable substitution."""
    raw = _CONFIG_PATH.read_text(encoding="utf-8")

    def _resolve(match):
        return os.getenv(match.group(1), match.group(0))

    raw = re.sub(r"\$\{(\w+)\}", _resolve, raw)
    return yaml.safe_load(raw)


cfg = load_config()
