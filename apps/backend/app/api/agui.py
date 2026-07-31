"""AG-UI endpoint — expose agent thống nhất qua giao thức AG-UI.

Mount tại /api/agent khi AGUI_ENABLED. Auth: middleware của sub-app validate
JWT (cùng luật với core.security.get_current_user — không dùng Depends được
vì ag_ui_langgraph sở hữu route handler), load User, stash profile vào
current_agent_profile cho inject_request_user (Task 2).

Route `GET /threads/{thread_id}/messages` bên dưới KHÔNG bị ag_ui_langgraph sở
hữu (do chính module này đăng ký), nên nó dùng Depends bình thường; nó vẫn
thừa hưởng `agui_auth` middleware ở trên vì cùng mount trên `agui_app`.
"""
from __future__ import annotations

import json
import logging
import re
import uuid

from ag_ui_langgraph import add_langgraph_fastapi_endpoint
from ag_ui_langgraph.utils import langchain_messages_to_agui
from copilotkit import CopilotKitMiddleware, LangGraphAGUIAgent
from fastapi import Depends, FastAPI, HTTPException
from jose import JWTError, jwt
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.api.chat import DEFAULT_ROOM_TITLE, _build_profile_dict
from app.core import database as db_module
from app.core.config import DATABASE_URL_RAW, JWT_ALGORITHM, JWT_SECRET
from app.core.database import get_db
from app.models.chat import ChatRoom
from app.models.user import User
from app.services.agent.chains.skill_advisor_chain import build_agent
from app.services.agent.context import current_agent_user_id, require_agent_user_id
from app.services.agent.middleware.request_user import current_agent_profile

logger = logging.getLogger(__name__)

AGENT_NAME = "talentpuse_assistant"

# Dock threads (components/copilot/DockChat.tsx:33) — `dock-<userId>` cho lượt
# đầu, `dock-<userId>-<n>` sau mỗi lần bấm "Cuộc trò chuyện mới". Chúng KHÔNG
# có hàng ChatRoom nào (đó là lý do GET /threads/... trả 404 mà dock vẫn chạy),
# nên quyền sở hữu phải đọc thẳng từ chính chuỗi id.
_DOCK_THREAD_RE = re.compile(r"^dock-([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:-\d+)?$")

agui_app = FastAPI(title="TalentPuse AG-UI")

_checkpointer_cm = None  # async context manager giữ pool
_graph = None  # graph LangGraph (build_agent(...)) — set trong init_agui, đọc
# read-only bởi get_thread_messages bên dưới (KHÔNG chạy graph, chỉ aget_state).


async def _thread_belongs_to(thread_id: str, user: User, db: AsyncSession) -> bool:
    """Caller có được chạy agent trên `thread_id` này không?

    `AsyncPostgresSaver` khoá checkpoint THUẦN theo thread_id, nên nếu không
    chặn ở đây thì bất kỳ ai đoán được thread_id của người khác đều nạp được
    hội thoại riêng tư của họ làm ngữ cảnh rồi ghi tiếp vào đó — đúng lỗ mà
    `get_thread_messages` bên dưới đã chặn cho đường ĐỌC nhưng đường CHẠY thì
    chưa. Hai dạng thread, hai cách chứng minh quyền sở hữu:

    1. `dock-<userId>[-n]` — id tự chứa danh tính, so thẳng, không tra DB.
       Dạng này NGUY HIỂM hơn UUID vì suy được từ user id (không cần đoán).
    2. UUID — chính là `ChatRoom.id` do client sinh; tra bảng chat_rooms.

    Với dạng 2 và chưa có ChatRoom: nếu thread ĐÃ có checkpoint thì không cách
    nào biết ai là chủ ⇒ từ chối. Nếu chưa có checkpoint thì đây là thread mới
    tinh ⇒ nhận chủ cho caller NGAY, tạo luôn ChatRoom. Phải tạo ở đây (không
    ỷ vào `useRoomRegistration` bên FE, vốn cố ý nuốt lỗi) — nếu không, lượt
    createRoom hụt sẽ biến thread của chính chủ thành mồ côi và tin nhắn THỨ
    HAI của họ bị chặn.
    """
    dock = _DOCK_THREAD_RE.match(thread_id)
    if dock is not None:
        return uuid.UUID(dock.group(1)) == user.id

    try:
        room_id = uuid.UUID(thread_id)
    except ValueError:
        return False

    room = await db.get(ChatRoom, room_id)
    if room is not None:
        return room.user_id == user.id

    existing_checkpoint = await db.execute(
        text("SELECT 1 FROM public.checkpoints WHERE thread_id = :tid LIMIT 1"),
        {"tid": thread_id},
    )
    if existing_checkpoint.first() is not None:
        return False

    db.add(ChatRoom(id=room_id, user_id=user.id, title=DEFAULT_ROOM_TITLE))
    try:
        await db.commit()
    except IntegrityError:
        # Hai request song song cùng claim một thread mới: người thua đọc lại
        # xem người thắng có phải chính mình không.
        await db.rollback()
        room = await db.get(ChatRoom, room_id)
        return room is not None and room.user_id == user.id
    return True


def _thread_id_from(body: bytes) -> str | None:
    """`RunAgentInput.thread_id` với alias_generator=to_camel ⇒ JSON là
    `threadId`; `populate_by_name=True` nên snake_case cũng hợp lệ."""
    try:
        payload = json.loads(body)
    except (ValueError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    value = payload.get("threadId") or payload.get("thread_id")
    return value if isinstance(value, str) and value else None


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

    # Route run/stream do `ag_ui_langgraph` sở hữu nên không gắn Depends được;
    # chặn quyền sở hữu thread ở đây, TRƯỚC khi graph kịp nạp checkpoint. Chỉ
    # POST mới cần: GET /threads/{id}/messages đã tự kiểm bên dưới.
    if request.method == "POST":
        body = await request.body()

        # `await request.body()` tiêu luôn receive channel; app phía sau sẽ
        # treo chờ body không bao giờ tới nếu không bơm lại.
        async def _receive() -> dict:
            return {"type": "http.request", "body": body, "more_body": False}

        request._receive = _receive  # type: ignore[attr-defined]

        thread_id = _thread_id_from(body)
        if thread_id is None:
            return JSONResponse({"detail": "Thiếu threadId"}, status_code=422)
        async with db_module.async_session_factory() as db:
            if not await _thread_belongs_to(thread_id, user, db):
                # 404 chứ không 403 — không lộ sự tồn tại của thread, giống hệt
                # get_thread_messages và các handler room trong app/api/chat.py.
                logger.warning(
                    "Chặn truy cập thread %s bởi user %s", thread_id, user.id
                )
                return JSONResponse({"detail": "Room not found"}, status_code=404)

    ctx_token = current_agent_profile.set(_build_profile_dict(user))
    uid_token = current_agent_user_id.set(user.id)
    try:
        return await call_next(request)
    finally:
        current_agent_profile.reset(ctx_token)
        current_agent_user_id.reset(uid_token)


async def init_agui(app: FastAPI) -> None:
    """Gọi trong lifespan (sau init_db): tạo checkpointer, build graph, mount."""
    global _checkpointer_cm, _graph
    _checkpointer_cm = AsyncPostgresSaver.from_conn_string(DATABASE_URL_RAW)
    checkpointer = await _checkpointer_cm.__aenter__()
    await checkpointer.setup()  # tạo tables checkpoints/... nếu chưa có

    # Giữ lại graph (module-scope) để get_thread_messages đọc state read-only
    # (aget_state) mà không phải build lại hay đụng tới route run/stream.
    _graph = build_agent(
        checkpointer=checkpointer,
        extra_middleware=[CopilotKitMiddleware()],
    )

    add_langgraph_fastapi_endpoint(
        app=agui_app,
        agent=LangGraphAGUIAgent(
            name=AGENT_NAME,
            description="Trợ lý sự nghiệp TalentPuse",
            # CopilotKitMiddleware: emit đúng AG-UI events (mitigation bug #2329, spec §6.3)
            graph=_graph,
        ),
        path="/",
    )
    app.mount("/api/agent", agui_app)
    logger.info("AG-UI endpoint mounted at /api/agent (agent=%s)", AGENT_NAME)


@agui_app.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Đọc lại lịch sử tin nhắn đã checkpoint của 1 thread — read-only.

    Dùng `graph.aget_state(...)` (đúng lời gọi mà `ag_ui_langgraph` tự dùng
    nội bộ), KHÔNG chạy graph. Cố tình KHÔNG "câu" lịch sử bằng cách gọi route
    run/stream với `messages` rỗng — heuristic regenerate của
    `ag_ui_langgraph.agent.prepare_stream` có thể coi đó là một lượt chạy thật
    (LLM call thật, tính phí, ghi thêm vào thread) — xem rehydration-research.md §2f/§5.

    Bảo mật (thread_id do CLIENT tự sinh — UUID đoán được): phải xác thực
    caller là chủ `ChatRoom` có cùng id trước khi đọc checkpoint, nếu không
    bất kỳ user nào biết/đoán được thread_id của người khác đều đọc được hội
    thoại riêng tư của họ. Trả 404 (không phải 403) khi không tìm thấy hoặc
    không phải chủ sở hữu — để không lộ sự tồn tại của phòng, giống hệt hành
    vi của get_messages/delete_room/create_room trong app/api/chat.py.
    """
    try:
        room_id = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(404, "Room not found") from None

    room = await db.get(ChatRoom, room_id)
    if room is None or room.user_id != require_agent_user_id():
        raise HTTPException(404, "Room not found")

    if _graph is None:
        raise HTTPException(503, "Agent chưa sẵn sàng")

    state = await _graph.aget_state({"configurable": {"thread_id": thread_id}})
    # Thread chưa có checkpoint (chưa gửi tin nào) → values rỗng, KHÔNG phải lỗi.
    messages = (state.values or {}).get("messages", [])
    agui_messages = langchain_messages_to_agui(messages)
    # Chỉ giữ lại lượt hội thoại thật (user/assistant). Loại các SystemMessage
    # nội bộ mà middleware tự chèn mỗi lượt gọi model — "App Context: {...}"
    # (copilotkit_lg_middleware.py) và "__user_profile__" (profile_injection.py)
    # — những message này không phải do người dùng hay assistant tạo ra và
    # KHÔNG BAO GIỜ được render thành bong bóng chat ở frontend. Lọc ở đây
    # (điểm chung duy nhất mọi consumer đều đi qua) thay vì ở từng nơi gọi.
    visible_messages = [m for m in agui_messages if m.role in ("user", "assistant")]
    return [m.model_dump(by_alias=True, exclude_none=True) for m in visible_messages]


async def close_agui() -> None:
    global _checkpointer_cm, _graph
    _graph = None
    if _checkpointer_cm is not None:
        await _checkpointer_cm.__aexit__(None, None, None)
        _checkpointer_cm = None
