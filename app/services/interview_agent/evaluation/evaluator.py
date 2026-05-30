"""Answer evaluation services.

Evaluates individual answers during interview sessions.
Uses existing agent's LLM factory.
"""

import json
from typing import Optional

from langchain_core.messages import SystemMessage

from app.services.agent.services.llm import create_llm
from app.services.interview_agent.models.schemas import InterviewEvaluation


# =============================================================================
# Technical Interview Evaluator
# =============================================================================


TECH_EVALUATION_PROMPT = """Bạn là Interviewer Kỹ thuật Chuyên nghiệp, đang đánh giá câu trả lời của ứng viên.

**Câu hỏi:**
{question}

**Câu trả lời của ứng viên:**
{answer}

**Profile ứng viên:**
- Skills: {skills}
- Experience Level: {experience_level}
- Target Role: {target_role}

**Thang điểm:**
- 5.0 (Xuất sắc): Comprehensive, consider trade-offs, mention specific tech, clear communication
- 4.0 (Tốt): Solid approach, mention tools/technologies, minor gaps
- 3.0 (Khá): Basic understanding, some gaps in technical depth
- 2.0 (Trung bình): Partial understanding, significant gaps
- 1.0 (Yếu): Incorrect hoặc irrelevant

**Output Format (JSON ONLY, không thêm text nào khác):**
```json
{{
  "score": <float 1.0-5.0>,
  "feedback": "<narrative feedback 2-3 câu, cụ thể, không chung chung>",
  "strengths": ["<điểm mạnh cụ thể 1>", "<điểm mạnh cụ thể 2>"],
  "improvements": ["<cải thiện cụ thể 1>", "<cải thiện cụ thể 2>"],
  "suggested_answer": "<câu trả lời gợi ý good, technical depth vừa phải>"
}}
```

**Nguyên tắc:**
- score PHẢI là float trong range [1.0, 5.0]
- feedback PHẢI specific: "Đã mention Redis" thay vì "Trả lời tốt"
- strengths/improvements PHẢI actionable
- suggested_answer PHẢI technical, không chung chung
"""


async def evaluate_tech_answer(
    question: str,
    answer: str,
    profile: dict,
    target_role: str = "Software Engineer",
) -> InterviewEvaluation:
    """Evaluate a technical interview answer.

    Args:
        question: The technical question asked
        answer: User's answer
        profile: User profile dict (skills, experience_level, etc.)
        target_role: Target job role

    Returns:
        InterviewEvaluation with score, feedback, strengths, improvements
    """
    llm = create_llm()

    # Format prompt with context
    skills = ", ".join(profile.get("skills", []))
    experience_level = profile.get("experience_level", "mid")

    prompt = TECH_EVALUATION_PROMPT.format(
        question=question,
        answer=answer,
        skills=skills,
        experience_level=experience_level,
        target_role=target_role,
    )

    try:
        response = await llm.ainvoke(
            [SystemMessage(content=prompt)],
        )

        # Parse JSON response
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]  # Remove ```json
        if content.startswith("```"):
            content = content[3:]  # Remove ```
        if content.endswith("```"):
            content = content[:-3]  # Remove ```

        result = json.loads(content)

        return InterviewEvaluation(
            score=float(result["score"]),
            feedback=str(result["feedback"]),
            strengths=list(result.get("strengths", [])),
            improvements=list(result.get("improvements", [])),
            suggested_answer=result.get("suggested_answer"),
        )

    except Exception as e:
        # Fallback on error
        return InterviewEvaluation(
            score=3.0,
            feedback=f"Evaluation unavailable (error: {str(e)})",
            strengths=[],
            improvements=["Unable to evaluate due to technical error"],
        )


# =============================================================================
# Behavioral Interview Evaluator
# =============================================================================


BEHAVIORAL_EVALUATION_PROMPT = """Bạn là Interviewer Hành Vi Chuyên nghiệp, đang đánh giá câu trả lời STAR của ứng viên.

**Câu hỏi behavioral:**
{question}

**Câu trả lời của ứng viên:**
{answer}

**STAR Cues (đã cung cấp với câu hỏi):**
- Situation: {star_situation}
- Task: {star_task}
- Action: {star_action}
- Result: {star_result}

**Thang điểm STAR:**
- Situation (20%): Context rõ, relevant, concise
- Task (20%): Goal specific, measurable, clear
- Action (30%): Step-by-step, ownership shown
- Result (30%): Quantified metrics, clear impact

**Thang điểm tổng:**
- 5.0 (Xuất sắc): STAR hoàn chỉnh, action cụ thể, result định lượng
- 4.0 (Tốt): Đủ STAR, kha cụ thể, result có thể thiếu số liệu
- 3.0 (Khá): Có cấu trúc nhưng một phần STAR thiếu hoặc chung chung
- 2.0 (Trung bình): Thiếu STAR, answer surface-level
- 1.0 (Yếu): Không liên quan hoặc quá ngắn không có substance

**Output Format (JSON ONLY, không thêm text nào khác):**
```json
{{
  "score": <float 1.0-5.0>,
  "feedback": "<narrative feedback với STAR coaching 2-3 câu>",
  "strengths": ["<STAR element well-done cụ thể>"],
  "improvements": ["<STAR element cần improve, actionable>"],
  "suggested_answer": "<câu trả lời mẫu STAR hoàn chỉnh, personalized>"
}}
```

**Nguyên tắc:**
- Score PHẢI reflect STAR quality
- Feedback PHẢI coach STAR structure
- Strengths/improvements PHẢI mention cụ thể S/T/A/R
- Suggested answer PHẢI STAR format hoàn chỉnh
"""


async def evaluate_behavioral_answer(
    question: str,
    answer: str,
    star_cues: dict,
    profile: dict,
) -> InterviewEvaluation:
    """Evaluate a behavioral interview answer.

    Args:
        question: The behavioral question asked
        answer: User's answer
        star_cues: STAR cues provided with the question
        profile: User profile dict

    Returns:
        InterviewEvaluation with score, feedback, strengths, improvements
    """
    llm = create_evaluation_llm()

    # Format prompt with STAR cues
    prompt = BEHAVIORAL_EVALUATION_PROMPT.format(
        question=question,
        answer=answer,
        star_situation=star_cues.get("situation", "N/A"),
        star_task=star_cues.get("task", "N/A"),
        star_action=star_cues.get("action", "N/A"),
        star_result=star_cues.get("result", "N/A"),
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

        return InterviewEvaluation(
            score=float(result["score"]),
            feedback=str(result["feedback"]),
            strengths=list(result.get("strengths", [])),
            improvements=list(result.get("improvements", [])),
            suggested_answer=result.get("suggested_answer"),
        )

    except Exception as e:
        # Fallback on error
        return InterviewEvaluation(
            score=3.0,
            feedback=f"Evaluation unavailable (error: {str(e)})",
            strengths=[],
            improvements=["Unable to evaluate due to technical error"],
        )
