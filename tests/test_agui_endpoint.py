"""AG-UI endpoint tests.

Two layers:
  1. Auth unit tests (module-level, always run) — hit `agui_app` directly via
     ASGITransport. `agui_auth` rejects unauthenticated/invalid tokens BEFORE
     any DB query or routing, so these need no live Postgres and no
     `init_agui()` call. Covers the 401 branches left untested in Task 3.
  2. Integration smoke tests (class-level, gated) — boot the full app with
     `AGUI_ENABLED=1`, need Postgres (checkpointer.setup() connects) →
     run with:
       RUN_DB_TESTS=1 python -m pytest tests/test_agui_endpoint.py -v
     LLM is mocked (FakeToolModel) — no network calls.
"""
from __future__ import annotations

import asyncio
import os
import sys
import uuid

import httpx
import pytest
from asgi_lifespan import LifespanManager
from jose import jwt
from langchain_core.messages import AIMessage

from app.core.config import JWT_ALGORITHM


@pytest.fixture
def event_loop_policy():
    """Force SelectorEventLoop on Windows for this module.

    `AsyncPostgresSaver` (psycopg async) refuses to run under
    `ProactorEventLoop` — Windows' asyncio default since 3.8 — with
    `psycopg.InterfaceError: Psycopg cannot use the 'ProactorEventLoop'...`.
    conftest.py's session-scoped `setup_event_loop` fixture tries to set
    `WindowsSelectorEventLoopPolicy` globally, but pytest-asyncio creates its
    per-test loop before that fixture's body runs, so the test loop ends up
    Proactor anyway. Overriding this pytest-asyncio-recognized fixture name
    (deprecated in favor of the `pytest_asyncio_loop_factories` hook, which
    requires a conftest.py change out of scope here) is the narrowest fix
    that stays local to this file.
    """
    if sys.platform == "win32":
        return asyncio.WindowsSelectorEventLoopPolicy()
    return asyncio.get_event_loop_policy()


def _fake_model():
    from langchain_core.language_models.fake_chat_models import GenericFakeChatModel

    class _Fake(GenericFakeChatModel):
        def bind_tools(self, tools, **kwargs):
            return self

    return _Fake(messages=iter([AIMessage(content="Chào bạn, mình là TalentPuse!")]))


# ---------------------------------------------------------------------------
# 1. DB-independent auth unit tests — no RUN_DB_TESTS gate, no init_agui().
# ---------------------------------------------------------------------------


async def test_agui_missing_header_returns_401():
    from app.api.agui import agui_app

    transport = httpx.ASGITransport(app=agui_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post("/", json={})
    assert resp.status_code == 401


async def test_agui_garbage_bearer_token_returns_401():
    from app.api.agui import agui_app

    transport = httpx.ASGITransport(app=agui_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/", json={}, headers={"Authorization": "Bearer garbage.not.a.jwt"}
        )
    assert resp.status_code == 401


async def test_agui_wrong_signature_token_returns_401():
    """Syntactically-valid JWT, wrong signing secret → rejected without DB lookup."""
    from app.api.agui import agui_app

    bad_token = jwt.encode(
        {"sub": str(uuid.uuid4())}, "not-the-real-secret", algorithm=JWT_ALGORITHM
    )
    transport = httpx.ASGITransport(app=agui_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/", json={}, headers={"Authorization": f"Bearer {bad_token}"}
        )
    assert resp.status_code == 401


async def test_agui_expired_token_returns_401():
    """Correct secret/algorithm but expired `exp` claim → rejected without DB lookup."""
    from datetime import datetime, timedelta, timezone

    from app.api.agui import agui_app
    from app.core.config import JWT_SECRET

    expired_token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=5),
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )
    transport = httpx.ASGITransport(app=agui_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        resp = await c.post(
            "/", json={}, headers={"Authorization": f"Bearer {expired_token}"}
        )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# 2. Integration smoke — needs live Postgres (checkpointer.setup()).
# ---------------------------------------------------------------------------

pytestmark_db = pytest.mark.skipif(
    os.getenv("RUN_DB_TESTS") != "1",
    reason="needs live Postgres — set RUN_DB_TESTS=1",
)


@pytest.fixture()
async def client(monkeypatch):
    monkeypatch.setenv("AGUI_ENABLED", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    import importlib

    import app.core.config as config

    importlib.reload(config)
    from app.services.agent.chains import skill_advisor_chain as chain

    monkeypatch.setattr(chain, "_get_llm", _fake_model)
    chain._agent = None

    # `app.api.agui` module (agui_app FastAPI instance + `_checkpointer_cm`
    # global) is cached in sys.modules across tests. Without reloading it,
    # a second test reusing this fixture would call `init_agui()` again on
    # the SAME `agui_app`, registering a second route on top of the first
    # test's — Starlette matches the first-registered route, which still
    # closes over the FIRST test's (by-then-closed) checkpointer connection,
    # causing `psycopg.OperationalError: the connection is closed`. Reload
    # to get a fresh `agui_app` + `_checkpointer_cm = None` per test.
    import app.api.agui as agui_module

    importlib.reload(agui_module)

    import app.main as main

    importlib.reload(main)
    async with LifespanManager(main.app):
        transport = httpx.ASGITransport(app=main.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            yield c


@pytestmark_db
async def test_agui_requires_token(client):
    resp = await client.post("/api/agent/", json={})
    assert resp.status_code == 401


@pytestmark_db
async def test_agui_streams_with_valid_token(client):
    # NOTE: `.local` is an RFC 6761 special-use TLD rejected by pydantic's
    # EmailStr (email-validator) — use `example.com` (RFC 2606 reserved for
    # documentation/testing, syntactically valid) instead.
    email = f"agui-test-{uuid.uuid4().hex[:8]}@example.com"
    signup = await client.post(
        "/api/auth/signup",
        json={"email": email, "password": "Test12345!", "full_name": "AGUI Test"},
    )
    assert signup.status_code == 201, signup.text
    login = await client.post(
        "/api/auth/login", json={"email": email, "password": "Test12345!"}
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    body = {
        "threadId": str(uuid.uuid4()),
        "runId": str(uuid.uuid4()),
        "messages": [{"id": "1", "role": "user", "content": "xin chào"}],
        "state": {},
        "tools": [],
        "context": [],
        "forwardedProps": {},
    }
    async with client.stream(
        "POST",
        "/api/agent/",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
    ) as resp:
        assert resp.status_code == 200, await resp.aread()
        assert resp.headers["content-type"].startswith("text/event-stream")
        first = b""
        async for chunk in resp.aiter_bytes():
            first += chunk
            if len(first) > 200:
                break
        assert b"RUN" in first.upper()  # RUN_STARTED event
