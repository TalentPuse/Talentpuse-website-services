"""Session summary generation service.

Generates end-of-session summaries with:
- Overall score (1.0-5.0)
- Overall feedback narrative
- Strengths and improvements lists
- Actionable improvement plan
"""

import json
from typing import Optional

from langchain_core.messages import SystemMessage

from app.services.agent.services.llm import create_llm
from app.services.interview_agent.models.schemas import SessionSummary


# =============================================================================
# Session Summary Prompts
# =============================================================================


SESSION_SUMMARY_PROMPT = """Bạn là AI Interview Coach chuyên nghiệp của TalentPulse. Hãy tạo báo cáo tổng hợp cho buổi phỏng vấn.

**Thông tin ứng viên:**
{profile_section}

**Vị trí ứng tuyển:** {target_role}

**Loại phỏng vấn:** {mode}

**Số câu hỏi đã trao đổi:** {question_count}

**Transcript phỏng vấn:**
{transcript}

**Đánh giá từng câu (nếu có):**
{evaluations_summary}

**Output Format (JSON ONLY, không thêm text nào khác):**
```json
{{
  "overall_score": <weighted average 1.0-5.0>,
  "overall_feedback": "<nhận xét chung 3-5 câu, specific, không chung chung, tiếng Việt>",
  "strengths": ["<điểm mạnh cụ thể 1>", "<điểm mạnh cụ thể 2>", "<điểm mạnh cụ thể 3>"],
  "improvements": ["<cần cải thiện cụ thể 1>", "<cần cải thiện cụ thể 2>", "<cần cải thiện cụ thể 3>"],
  "improvement_plan": "<kế hoạch cải thiện 3-5 bước, specific, actionable, có deadline/rêtre source>",
  "question_count": {question_count}
}}
```

**Nguyên tắc:**
- overall_score PHẢI reflect toàn bộ session, không chỉ average đơn thuần
- overall_feedback PHẢI nêu rõ điểm mạnh + điểm yếu chính, không chung chung
- strengths PHẢI extract từ transcript, không generic
- improvements PHẢI specific: "Luyện thêm system design scalability" không phải "Cải thiện technical"
- improvement_plan PHẢI actionable với resources (courses, books, practice topics)
- Xem xét profile ứng viên để customize feedback
"""


TECH_SUMMARY_TEMPLATE = """
**Technical Interview Summary:**

Điểm mạnh:
- {strength_1}
- {strength_2}
- {strength_3}

Cần cải thiện:
- {improvement_1}
- {improvement_2}

Kế hoạch cải thiện:
1. {step_1}
2. {step_2}
3. {step_3}
"""


BEHAVIORAL_SUMMARY_TEMPLATE = """
**Behavioral Interview Summary:**

Điểm mạnh STAR:
- {strength_1}
- {strength_2}

Cần cải thiện STAR:
- {improvement_1}
- {improvement_2}

Kế hoạch cải thiện:
1. {step_1}
2. {step_2}
3. {step_3}
"""


# =============================================================================
# Summary Generation Functions
# =============================================================================


def _format_profile(profile: dict) -> str:
    """Format user profile for summary prompt."""
    lines = []
    if profile.get("full_name"):
        lines.append(f"- Tên: {profile['full_name']}")
    if profile.get("skills"):
        lines.append(f"- Skills: {', '.join(profile['skills'])}")
    if profile.get("experience_level"):
        lines.append(f"- Kinh nghiệm: {profile['experience_level']}")
    if profile.get("desired_titles"):
        lines.append(f"- Vị trí mong muốn: {', '.join(profile['desired_titles'])}")
    return "\n".join(lines) if lines else "- Chưa có thông tin profile"


def _format_transcript(messages: list[dict]) -> str:
    """Format interview messages into transcript."""
    lines = []
    for msg in messages:
        role_vi = "Người dùng" if msg["role"] == "user" else "Interviewer"
        lines.append(f"**{role_vi}:** {msg['content']}")
    return "\n\n".join(lines)


def _format_evaluations(evaluations: list) -> str:
    """Format evaluation results into summary."""
    if not evaluations:
        return "- Chưa có đánh giá chi tiết"

    lines = []
    for i, eval in enumerate(evaluations, 1):
        lines.append(f"Câu {i}: Score {eval.get('score', 'N/A')}/5.0")
        if eval.get("feedback"):
            lines.append(f"  Feedback: {eval['feedback']}")
    return "\n".join(lines)


async def generate_session_summary(
    mode: str,
    messages: list[dict],
    profile: dict,
    target_role: str = "Software Engineer",
    evaluations: Optional[list[dict]] = None,
) -> SessionSummary:
    """Generate session summary with score and improvement plan.

    Args:
        mode: Interview mode ("technical" or "behavioral")
        messages: List of interview messages (transcript)
        profile: User profile dict
        target_role: Target job role
        evaluations: Optional list of individual answer evaluations

    Returns:
        SessionSummary with overall_score, feedback, strengths, improvements, plan
    """
    llm = create_evaluation_llm()

    # Build prompt
    profile_text = _format_profile(profile)
    transcript_text = _format_transcript(messages)
    evaluations_text = _format_evaluations(evaluations or [])

    prompt = SESSION_SUMMARY_PROMPT.format(
        profile_section=profile_text,
        target_role=target_role,
        mode=mode,
        question_count=len([m for m in messages if m["role"] == "user"]),
        transcript=transcript_text,
        evaluations_summary=evaluations_text,
    )

    try:
        response = await llm.ainvoke([SystemMessage(content=prompt)])

        # Parse JSON response
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        result = json.loads(content)

        return SessionSummary(
            overall_score=float(result["overall_score"]),
            overall_feedback=str(result["overall_feedback"]),
            strengths=list(result.get("strengths", [])),
            improvements=list(result.get("improvements", [])),
            improvement_plan=str(result["improvement_plan"]),
            question_count=int(result.get("question_count", len(messages) // 2)),
        )

    except Exception as e:
        # Fallback on error
        return SessionSummary(
            overall_score=3.0,
            overall_feedback=f"Unable to generate summary due to error: {str(e)}",
            strengths=["Unable to extract strengths"],
            improvements=["Unable to extract improvements"],
            improvement_plan="Please try again later",
            question_count=len(messages) // 2,
        )
