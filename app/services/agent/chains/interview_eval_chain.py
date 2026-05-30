"""Interview evaluation chain — LLM-based STAR answer evaluation."""

from __future__ import annotations

import json
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from app.services.agent.prompts.interview_eval_prompt import EVAL_PROMPT, REPORT_PROMPT
from app.services.agent.services.llm import create_llm

logger = logging.getLogger(__name__)

_chain = None


def _get_chain():
    global _chain
    if _chain is not None:
        return _chain
    _chain = create_llm()
    return _chain


def _format_profile(profile: dict | None) -> str:
    if not profile:
        return "Khong co thong tin profile."
    lines = []
    if profile.get("full_name"):
        lines.append(f"- Ho ten: {profile['full_name']}")
    if profile.get("desired_titles"):
        lines.append(f"- Vi tri mong muon: {', '.join(profile['desired_titles'])}")
    if profile.get("skills"):
        lines.append(f"- Ky nang: {', '.join(profile['skills'][:10])}")
    if profile.get("experience_level"):
        lines.append(f"- Kinh nghiem: {profile['experience_level']}")
    return "\n".join(lines) if lines else "Khong co thong tin profile."


def _extract_content(response) -> str:
    """Extract text content from LLM response, handling reasoning models."""
    content = response.content if hasattr(response, "content") else str(response)

    logger.debug(
        "LLM response: content_type=%s content_len=%s kwargs_keys=%s",
        type(content).__name__,
        len(content) if content else 0,
        list(getattr(response, "additional_kwargs", {}).keys()),
    )

    if not content or (isinstance(content, str) and not content.strip()):
        additional = getattr(response, "additional_kwargs", {})
        reasoning = additional.get("reasoning", "")
        if reasoning:
            logger.warning("LLM content empty, using reasoning field (%d chars)", len(reasoning))
            content = reasoning
        elif isinstance(content, list):
            parts = [p.get("text", "") for p in content if isinstance(p, dict) and "text" in p]
            content = "\n".join(parts)

    if isinstance(content, list):
        parts = [p.get("text", "") if isinstance(p, dict) else str(p) for p in content]
        content = "\n".join(parts)

    return str(content)


async def evaluate_answer(
    question_text: str,
    category: str,
    difficulty: str,
    star_cues: dict | None,
    evaluation_criteria: list[str] | None,
    answer_text: str,
    profile: dict | None = None,
) -> dict:
    """Evaluate a single behavioral interview answer. Returns parsed JSON."""
    star = star_cues or {}
    criteria_text = "\n".join(f"- {c}" for c in (evaluation_criteria or []))

    prompt = EVAL_PROMPT.format(
        profile_section=_format_profile(profile),
        question_text=question_text,
        category=category,
        difficulty=difficulty,
        star_situation=star.get("situation", "N/A"),
        star_task=star.get("task", "N/A"),
        star_action=star.get("action", "N/A"),
        star_result=star.get("result", "N/A"),
        criteria_text=criteria_text,
        answer_text=answer_text,
    )

    llm = _get_chain()
    response = await llm.ainvoke([SystemMessage(content=prompt)])

    content = _extract_content(response)

    try:
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        result = json.loads(cleaned)
        result["score"] = max(1.0, min(5.0, float(result.get("score", 3.0))))
        return result
    except (json.JSONDecodeError, ValueError):
        logger.exception("Failed to parse evaluation JSON: %s", content[:200])
        return {
            "score": 3.0,
            "strengths": "Khong the parse evaluation.",
            "improvements": "Vui long thu lai.",
            "suggested_answer": "",
        }


async def generate_report(
    session_data: dict,
    profile: dict | None = None,
) -> dict:
    """Generate comprehensive mock test report."""
    target_role = session_data.get("target_role", "IT Professional")

    summaries = []
    for q in session_data.get("answers", []):
        summaries.append(
            f"- [{q.get('category', '?')}] Score: {q.get('score', 'N/A')}/5 — "
            f"Strengths: {q.get('strengths', 'N/A')[:100]}... | "
            f"Improvements: {q.get('improvements', 'N/A')[:100]}..."
        )

    prompt = REPORT_PROMPT.format(
        profile_section=_format_profile(profile),
        target_role=target_role,
        questions_summary="\n".join(summaries),
    )

    llm = _get_chain()
    response = await llm.ainvoke([SystemMessage(content=prompt)])

    content = _extract_content(response)

    try:
        cleaned = content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        result = json.loads(cleaned)
        result["overall_score"] = max(1.0, min(5.0, float(result.get("overall_score", 3.0))))
        return result
    except (json.JSONDecodeError, ValueError):
        logger.exception("Failed to parse report JSON: %s", content[:200])
        return {
            "overall_score": 3.0,
            "overall_feedback": "Khong the tao bao cao.",
            "improvement_plan": "Vui long thu lai.",
        }
