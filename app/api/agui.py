"""AG-UI endpoint — expose agent thống nhất qua giao thức AG-UI.

Mount tại /api/agent khi AGUI_ENABLED. Auth: middleware của sub-app validate
JWT (cùng luật với core.security.get_current_user — không dùng Depends được
vì ag_ui_langgraph sở hữu route handler), load User, stash profile vào
current_agent_profile cho inject_request_user (Task 2).
"""
from __future__ import annotations

import logging

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from copilotkit import CopilotKitMiddleware, LangGraphAGUIAgent
from fastapi import FastAPI
from jose import JWTError, jwt
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlalchemy import select
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.api.chat import _build_profile_dict
from app.core import database as db_module
from app.core.config import DATABASE_URL_RAW, JWT_ALGORITHM, JWT_SECRET
from app.models.user import User
from app.services.agent.chains.skill_advisor_chain import build_agent
from app.services.agent.middleware.request_user import current_agent_profile

logger = logging.getLogger(__name__)

AGENT_NAME = "talentpuse_assistant"

agui_app = FastAPI(title="TalentPuse AG-UI")

_checkpointer_cm = None  # async context manager giữ pool


@agui_app.middleware("http")
async def agui_auth(request: Request, call_next):
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return JSONResponse({"detail": "Thiếu token"}, status_code=401)
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise JWTError("missing sub")
    except JWTError:
        return JSONResponse(
            {"detail": "Token không hợp lệ hoặc đã hết hạn"}, status_code=401
        )

    if db_module.async_session_factory is None:
        return JSONResponse({"detail": "DB chưa sẵn sàng"}, status_code=503)
    async with db_module.async_session_factory() as db:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return JSONResponse(
            {"detail": "Token không hợp lệ hoặc đã hết hạn"}, status_code=401
        )

    ctx_token = current_agent_profile.set(_build_profile_dict(user))
    try:
        return await call_next(request)
    finally:
        current_agent_profile.reset(ctx_token)


async def init_agui(app: FastAPI) -> None:
    """Gọi trong lifespan (sau init_db): tạo checkpointer, build graph, mount."""
    global _checkpointer_cm
    _checkpointer_cm = AsyncPostgresSaver.from_conn_string(DATABASE_URL_RAW)
    checkpointer = await _checkpointer_cm.__aenter__()
    await checkpointer.setup()  # tạo tables checkpoints/... nếu chưa có

    add_langgraph_fastapi_endpoint(
        app=agui_app,
        agent=LangGraphAGUIAgent(
            name=AGENT_NAME,
            description="Trợ lý sự nghiệp TalentPuse",
            # CopilotKitMiddleware: emit đúng AG-UI events (mitigation bug #2329, spec §6.3)
            graph=build_agent(
                checkpointer=checkpointer,
                extra_middleware=[CopilotKitMiddleware()],
            ),
        ),
        path="/",
    )
    app.mount("/api/agent", agui_app)
    logger.info("AG-UI endpoint mounted at /api/agent (agent=%s)", AGENT_NAME)


async def close_agui() -> None:
    global _checkpointer_cm
    if _checkpointer_cm is not None:
        await _checkpointer_cm.__aexit__(None, None, None)
        _checkpointer_cm = None
