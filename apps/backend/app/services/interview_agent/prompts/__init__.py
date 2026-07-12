"""System prompts for interview agents.

Different prompts for technical and behavioral interviews.
"""

from app.services.interview_agent.prompts.tech_prompts import (
    TECH_INTERVIEWER_SYSTEM,
)
from app.services.interview_agent.prompts.behavioral_prompts import (
    BEHAVIORAL_INTERVIEWER_SYSTEM,
)

__all__ = ["TECH_INTERVIEWER_SYSTEM", "BEHAVIORAL_INTERVIEWER_SYSTEM"]
