"""Quyền sở hữu thread ở đường CHẠY của AG-UI.

`AsyncPostgresSaver` khoá checkpoint thuần theo `thread_id`, nên nếu route run
không kiểm chủ sở hữu thì ai đoán được thread_id của người khác cũng nạp được
hội thoại riêng tư của họ làm ngữ cảnh rồi ghi tiếp vào đó. Trước bản vá,
`GET /threads/{id}/messages` chặn đúng nhưng `POST /` thì không — traffic thật
cho thấy `POST /api/agent/ → 200` trong khi `GET .../messages → 404` trên cùng
một thread.

Thread dock (`dock-<userId>`) nguy hiểm hơn UUID: nó SUY RA ĐƯỢC từ user id,
không cần đoán. Đó là lý do nhóm test đầu tiên tồn tại.

Không cần Postgres: nhánh dock thuần chuỗi, nhánh UUID dùng db giả.
"""
from __future__ import annotations

import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.api.agui import _thread_belongs_to, _thread_id_from

OWNER_ID = uuid.UUID("11111111-1111-4111-8111-111111111111")
ATTACKER_ID = uuid.UUID("22222222-2222-4222-8222-222222222222")


def _user(user_id: uuid.UUID = OWNER_ID) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, is_active=True)


def _db(room=None, has_checkpoint: bool = False, commit_conflict: bool = False):
    """db giả: `get` trả room, `execute` mô phỏng truy vấn EXISTS checkpoint."""
    db = MagicMock()
    db.get = AsyncMock(return_value=room)
    result = MagicMock()
    result.first = MagicMock(return_value=(1,) if has_checkpoint else None)
    db.execute = AsyncMock(return_value=result)
    db.add = MagicMock()
    db.commit = AsyncMock(
        side_effect=IntegrityError("dup", None, Exception()) if commit_conflict else None
    )
    db.rollback = AsyncMock()
    return db


# --- _thread_id_from ---------------------------------------------------------


@pytest.mark.parametrize(
    "payload,expected",
    [
        (b'{"threadId":"abc"}', "abc"),  # alias camelCase mà AG-UI thực gửi
        (b'{"thread_id":"abc"}', "abc"),  # populate_by_name=True
        (b"{}", None),
        (b"not json", None),
        (b'{"threadId":""}', None),
        (b'{"threadId":123}', None),
        (b'["threadId"]', None),
    ],
)
def test_thread_id_extraction(payload: bytes, expected: str | None):
    assert _thread_id_from(payload) == expected


# --- nhánh dock: id tự chứa danh tính, không tra DB --------------------------


async def test_dock_thread_of_own_user_allowed():
    db = _db()
    assert await _thread_belongs_to(f"dock-{OWNER_ID}", _user(), db) is True
    db.get.assert_not_awaited()  # không được chạm DB


async def test_dock_thread_of_another_user_rejected():
    """Lỗ CRITICAL: biết user_id là dựng được thread_id của họ."""
    db = _db()
    assert await _thread_belongs_to(f"dock-{ATTACKER_ID}", _user(), db) is False


async def test_dock_thread_with_generation_suffix_allowed():
    """"Cuộc trò chuyện mới" thêm hậu tố -<n> (DockChat.tsx:34)."""
    assert await _thread_belongs_to(f"dock-{OWNER_ID}-3", _user(), _db()) is True


async def test_dock_thread_with_generation_suffix_of_another_user_rejected():
    assert await _thread_belongs_to(f"dock-{ATTACKER_ID}-3", _user(), _db()) is False


async def test_malformed_dock_thread_rejected():
    assert await _thread_belongs_to("dock-not-a-uuid", _user(), _db()) is False


async def test_non_uuid_thread_rejected():
    assert await _thread_belongs_to("../etc/passwd", _user(), _db()) is False


@pytest.mark.parametrize("style", ["braces", "urn", "upper", "nodash"])
async def test_non_canonical_uuid_encoding_rejected(style: str):
    """Biến thể mã hoá UUID phải bị từ chối, kể cả khi thread MỚI TINH.

    `uuid.UUID()` nhận nhiều dạng cùng parse ra một UUID, nhưng truy vấn
    checkpoint dùng CHUỖI THÔ — nên một biến thể không khớp hàng checkpoint nào
    và bị coi là "thread mới", cho phép claim thread của người khác. Đã khai
    thác thật: gửi "{<uuid nạn nhân>}" tạo ChatRoom đúng id đó cho kẻ tấn công,
    sau đó gọi lại bằng uuid thường là đọc/ghi tiếp được hội thoại.
    """
    rid = uuid.uuid4()
    thread_id = {
        "braces": "{%s}" % rid,
        "urn": "urn:uuid:%s" % rid,
        "upper": str(rid).upper(),
        "nodash": rid.hex,
    }[style]
    db = _db(room=None, has_checkpoint=False)
    assert await _thread_belongs_to(thread_id, _user(), db) is False
    db.add.assert_not_called()  # không được claim


async def test_canonical_uuid_still_accepted():
    """Chốt chặn trên không được làm hỏng luồng hợp lệ."""
    db = _db(room=None, has_checkpoint=False)
    assert await _thread_belongs_to(str(uuid.uuid4()), _user(), db) is True


# --- nhánh UUID: tra ChatRoom ------------------------------------------------


async def test_existing_room_owned_by_caller_allowed():
    room_id = uuid.uuid4()
    db = _db(room=SimpleNamespace(id=room_id, user_id=OWNER_ID))
    assert await _thread_belongs_to(str(room_id), _user(), db) is True


async def test_existing_room_owned_by_someone_else_rejected():
    room_id = uuid.uuid4()
    db = _db(room=SimpleNamespace(id=room_id, user_id=ATTACKER_ID))
    assert await _thread_belongs_to(str(room_id), _user(), db) is False


async def test_orphan_thread_with_checkpoint_rejected():
    """Có checkpoint nhưng không có ChatRoom ⇒ không chứng minh được chủ."""
    db = _db(room=None, has_checkpoint=True)
    assert await _thread_belongs_to(str(uuid.uuid4()), _user(), db) is False
    db.add.assert_not_called()


async def test_brand_new_thread_is_claimed():
    """Chưa checkpoint, chưa room ⇒ thread mới tinh, claim ngay cho caller.

    Phải tạo ChatRoom tại đây chứ không ỷ vào useRoomRegistration bên FE (vốn
    cố ý nuốt lỗi): nếu không, một lượt createRoom hụt sẽ biến thread của chính
    chủ thành mồ côi và tin nhắn THỨ HAI của họ bị chặn.
    """
    db = _db(room=None, has_checkpoint=False)
    assert await _thread_belongs_to(str(uuid.uuid4()), _user(), db) is True
    db.add.assert_called_once()
    db.commit.assert_awaited_once()


async def test_claim_race_lost_to_same_user_allowed():
    """Hai request song song cùng claim: người thua đọc lại thấy chính mình."""
    room_id = uuid.uuid4()
    db = _db(room=None, has_checkpoint=False, commit_conflict=True)
    db.get = AsyncMock(side_effect=[None, SimpleNamespace(id=room_id, user_id=OWNER_ID)])
    assert await _thread_belongs_to(str(room_id), _user(), db) is True
    db.rollback.assert_awaited_once()


async def test_claim_race_lost_to_another_user_rejected():
    room_id = uuid.uuid4()
    db = _db(room=None, has_checkpoint=False, commit_conflict=True)
    db.get = AsyncMock(
        side_effect=[None, SimpleNamespace(id=room_id, user_id=ATTACKER_ID)]
    )
    assert await _thread_belongs_to(str(room_id), _user(), db) is False
