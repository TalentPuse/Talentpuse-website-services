import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.security import get_current_user
from app.core.database import get_db
from tests.test_cv import _make_fake_user


async def _fake_db():
    yield AsyncMock()


@pytest.mark.asyncio
async def test_get_document_returns_rendered_doc():
    user = _make_fake_user(cv_text="Bao - Python dev")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = _fake_db
    payload = {"model": {"header": {"full_name": "Bao", "email": "b@x.com"}},
               "pdf_url": "http://minio/x.pdf", "page_count": 1}
    with patch("app.api.cv.ensure_document", AsyncMock(return_value=payload)):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.get("/api/cv/document", headers={"Authorization": "Bearer x"})
    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.json()["model"]["header"]["full_name"] == "Bao"
    assert r.json()["page_count"] == 1


@pytest.mark.asyncio
async def test_get_document_pdf_streams_bytes():
    user = _make_fake_user(cv_text="Bao - Python dev")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = _fake_db
    with patch("app.api.cv.render_pdf_bytes", AsyncMock(return_value=b"%PDF-1.5 fake")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
            r = await c.get("/api/cv/document/pdf", headers={"Authorization": "Bearer x"})
    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content == b"%PDF-1.5 fake"
