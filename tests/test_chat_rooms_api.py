"""POST /api/chat/rooms chấp nhận id do client cấp, và idempotent."""
import uuid

import pytest


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
