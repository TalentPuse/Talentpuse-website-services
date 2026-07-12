"""POST /api/chat/rooms chấp nhận id do client cấp, và idempotent."""
import uuid

import pytest

from app.models.chat import ChatRoom
from app.models.user import User


@pytest.mark.asyncio
async def test_create_room_with_client_supplied_id(client, auth_headers):
    room_id = str(uuid.uuid4())
    r = await client.post(
        "/api/chat/rooms",
        json={"id": room_id, "title": "Tìm job Data Engineer"},
        headers=auth_headers,
    )
    assert r.status_code == 201
    assert r.json()["id"] == room_id
    assert r.json()["title"] == "Tìm job Data Engineer"


@pytest.mark.asyncio
async def test_create_room_twice_with_same_id_is_idempotent(client, auth_headers):
    room_id = str(uuid.uuid4())
    first = await client.post(
        "/api/chat/rooms", json={"id": room_id, "title": "Lần 1"}, headers=auth_headers
    )
    second = await client.post(
        "/api/chat/rooms", json={"id": room_id, "title": "Lần 2"}, headers=auth_headers
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert second.json()["id"] == room_id
    # Không ghi đè title của room đã tồn tại.
    assert second.json()["title"] == "Lần 1"


@pytest.mark.asyncio
async def test_create_room_without_id_still_works(client, auth_headers):
    r = await client.post("/api/chat/rooms", json={"title": None}, headers=auth_headers)
    assert r.status_code == 201
    assert r.json()["id"]


@pytest.mark.asyncio
async def test_create_room_rejects_id_owned_by_another_user(
    client, auth_headers, seed_user, db_session
):
    """Ownership check on the (now client-controlled) id: user B cannot claim,
    read, or mutate a room id that already belongs to user A."""
    owner = User(
        email=f"owner-{uuid.uuid4()}@example.com",
        hashed_password="test-hash",
        full_name="Room Owner",
    )
    db_session.add(owner)
    await db_session.commit()
    await db_session.refresh(owner)

    room_id = uuid.uuid4()
    room = ChatRoom(id=room_id, user_id=owner.id, title="Bí mật của A")
    db_session.add(room)
    await db_session.commit()
    await db_session.refresh(room)

    try:
        # `auth_headers` authenticates as `seed_user` (user B) — a different
        # user from `owner` (user A), who owns `room_id`.
        r = await client.post(
            "/api/chat/rooms",
            json={"id": str(room_id), "title": "Chiếm quyền"},
            headers=auth_headers,
        )

        assert r.status_code == 404
        assert "Bí mật của A" not in r.text

        await db_session.refresh(room)
        assert room.title == "Bí mật của A"
        assert room.user_id == owner.id
    finally:
        await db_session.delete(room)
        await db_session.delete(owner)
        await db_session.commit()
