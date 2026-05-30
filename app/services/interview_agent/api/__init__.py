"""Interview API endpoints.

FastAPI router for interview session management.
Provides SSE streaming for real-time chat responses.
"""

from app.services.interview_agent.api.interview_router import router as interview_router

__all__ = ["interview_router"]
