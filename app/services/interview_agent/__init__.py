"""TalentPulse Interview Agent — Chatbot for interview practice.

This is a SEPARATE agent system from the main career coaching agent.
Purpose: Help users practice interviews via conversational chatbot.

Two interview modes:
- Technical: System design, algorithms, coding
- Behavioral: STAR method, soft skills, culture fit

Architecture:
- LangChain agents for conversation management
- SSE streaming for real-time responses
- PostgreSQL for session persistence
- Voice-ready for future STT/TTS integration
"""

from app.services.interview_agent.api.interview_router import interview_router
from app.services.agent.middleware import AgentContext as InterviewContext

__all__ = ["interview_router", "InterviewContext"]
