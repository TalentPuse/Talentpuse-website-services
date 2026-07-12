from __future__ import annotations

from pydantic import BaseModel


class AlertDispatchResult(BaseModel):
    status: str
    alerts_sent: int = 0
    message: str = ""
