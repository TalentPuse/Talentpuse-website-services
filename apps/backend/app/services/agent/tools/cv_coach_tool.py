"""CV Coaching Tool — returns CV writing guidelines from knowledge base."""

from __future__ import annotations

from pathlib import Path

import yaml
from langchain_core.tools import tool

_YAML_PATH = Path(__file__).resolve().parent.parent / "knowledge" / "cv_coaching.yaml"
_cached_data: dict | None = None

_TOPIC_MAP = {
    "bullet_points": "bullet_points",
    "bullet": "bullet_points",
    "project": "project_description",
    "project_description": "project_description",
    "summary": "summary_section",
    "skills": "skills_section",
    "ats": "ats_optimization",
    "mistakes": "common_mistakes",
    "common_mistakes": "common_mistakes",
    "role_tips": "role_specific",
    "role_specific": "role_specific",
}


def _load_knowledge() -> dict:
    global _cached_data
    if _cached_data is None:
        with open(_YAML_PATH, encoding="utf-8") as f:
            _cached_data = yaml.safe_load(f)
    return _cached_data


def _format_section(data: dict) -> str:
    """Recursively format a YAML section into readable text."""
    lines: list[str] = []
    for key, value in data.items():
        if isinstance(value, list):
            lines.append(f"\n### {key}")
            for item in value:
                if isinstance(item, dict):
                    for k, v in item.items():
                        lines.append(f"- {k}: {v}")
                else:
                    lines.append(f"- {item}")
        elif isinstance(value, dict):
            lines.append(f"\n### {key}")
            lines.append(_format_section(value))
        else:
            lines.append(f"- {key}: {value}")
    return "\n".join(lines)


def _format_role_section(data: dict, role: str) -> str:
    """Format role-specific section."""
    role_key = role.lower().replace(" ", "_").replace("-", "_")
    role_data = data.get(role_key)
    if not role_data:
        available = ", ".join(data.keys())
        return f"Khong tim thay role '{role}'. Cac role co san: {available}"
    lines = [f"\n## CV tips cho {role_key}"]
    for key, value in role_data.items():
        if isinstance(value, list):
            lines.append(f"\n### {key}")
            for item in value:
                lines.append(f"- {item}")
        else:
            lines.append(f"- {key}: {value}")
    return "\n".join(lines)


@tool
async def get_cv_writing_guide(topic: str, role: str | None = None) -> str:
    """Get CV writing guidelines and examples for specific topics.

    Use this when user asks about: CV writing, bullet points, project descriptions,
    summary section, skills section, ATS optimization, CV mistakes, role-specific tips.

    Args:
        topic: One of: bullet_points, project_description, summary, skills, ats, mistakes, role_tips
        role: Optional target role for role-specific advice: backend, frontend, data_ai, qa, devops, fullstack
    """
    knowledge = _load_knowledge()

    topic_key = _TOPIC_MAP.get(topic.lower().strip())
    if not topic_key:
        available = ", ".join(sorted(set(_TOPIC_MAP.values())))
        return f"Topic '{topic}' khong hop le. Cac topic co san: {available}"

    if topic_key == "role_specific":
        if not role:
            return "Vui long chi dinh 'role' parameter. Vi du: backend, frontend, data_ai, qa, devops, fullstack"
        return _format_role_section(knowledge["role_specific"], role)

    section = knowledge.get(topic_key)
    if not section:
        return f"Khong co du lieu cho topic '{topic}'."

    return f"## CV Guide: {topic_key}\n" + _format_section(section)
