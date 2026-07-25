"""Unit tests for CV parser service and upload endpoint."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.user import User
from app.services.cv_parser import CvExtractResult, parse_cv, upload_to_s3


# ─── Helpers ─────────────────────────────────────────────

def _make_fake_user(**overrides):
    defaults = dict(
        id=uuid4(),
        email="user@example.com",
        hashed_password="$2b$12$fakehash",
        full_name="Test User",
        skills=[],
        desired_salary_min=None,
        desired_salary_max=None,
        preferred_cities=[],
        desired_titles=[],
        is_active=True,
        is_admin=False,
        subscription_tier="free",
        experience_level=None,
        university=None,
        graduation_year=None,
        open_to_internship=False,
        part_time_ok=False,
        cv_file_url=None,
        cv_text=None,
    )
    defaults.update(overrides)
    return User(**defaults)


async def _fake_get_db():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def _override_db():
    app.dependency_overrides[get_db] = _fake_get_db
    yield
    app.dependency_overrides.clear()


def _auth_override(fake_user):
    async def _override():
        return fake_user
    app.dependency_overrides[get_current_user] = _override


MOCK_EXTRACTED = {
    "full_name": "Nguyen Minh Bao",
    "email": "baonm@talentpuse.io.vn",
    "phone": "0901234567",
    "location": "Ho Chi Minh City",
    "summary": "Data Engineer with 3 years experience",
    "experience_level": "experienced",
    "years_of_experience": 3,
    "skills": ["python", "sql", "airflow", "dbt", "docker", "postgresql", "aws"],
    "desired_titles": ["Data Engineer", "Backend Developer"],
    "preferred_cities": ["HCMC"],
    "salary_min_m": 25,
    "salary_max_m": 40,
    "education": [
        {
            "university": "HCMUT",
            "major": "Computer Science",
            "degree": "Bachelor",
            "graduation_year": 2022,
            "gpa": 3.5,
        }
    ],
    "work_experience": [
        {
            "title": "Data Engineer",
            "company": "TechCorp",
            "start_date": "2022-06",
            "end_date": "present",
            "highlights": ["Built data pipeline", "Migrated to dbt"],
        }
    ],
    "projects": [
        {
            "name": "ETL Platform",
            "description": "Built end-to-end ETL platform",
            "tech_stack": ["python", "airflow", "dbt"],
        }
    ],
    "certifications": ["AWS SAA"],
    "languages": ["Vietnamese (Native)", "English (IELTS 7.0)"],
    "_confidence": {
        "skills": "high",
        "desired_titles": "high",
        "experience_level": "high",
        "preferred_cities": "medium",
        "salary_min_m": "low",
        "salary_max_m": "low",
    },
}


# ─── parse_cv unit tests ─────────────────────────────────

class TestParseCv:
    # OPENAI_API_KEY is a module-level import from config, so patch on cv_parser works
    def test_no_api_key(self):
        with patch("app.services.cv_parser.OPENAI_API_KEY", ""):
            result = parse_cv("some text")
        assert result.error == "OPENAI_API_KEY not configured"
        assert result.data == {}

    def test_empty_text(self):
        with patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test"):
            result = parse_cv("")
        assert "không chứa text" in result.error

    def test_whitespace_only(self):
        with patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test"):
            result = parse_cv("   \n\n  ")
        assert "không chứa text" in result.error

    @patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test")
    @patch("app.services.cv_parser.OPENAI_BASE_URL", "https://api.test.com/v1")
    @patch("app.services.cv_parser.OPENAI_MODEL", "gpt-4o")
    def test_successful_parse(self):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content=json.dumps(MOCK_EXTRACTED)))
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        # OpenAI is lazily imported inside parse_cv, so patch at source
        with patch("openai.OpenAI", return_value=mock_client):
            result = parse_cv("Nguyen Minh Bao - Data Engineer CV...")

        assert result.error is None
        assert result.data["full_name"] == "Nguyen Minh Bao"
        assert result.data["experience_level"] == "experienced"
        assert "python" in result.data["skills"]
        assert "sql" in result.data["skills"]
        assert len(result.data["work_experience"]) == 1
        assert result.data["work_experience"][0]["title"] == "Data Engineer"
        assert result.data["_confidence"]["skills"] == "high"
        assert result.raw_text_length > 0

    @patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test")
    @patch("app.services.cv_parser.OPENAI_BASE_URL", "https://api.test.com/v1")
    @patch("app.services.cv_parser.OPENAI_MODEL", "gpt-4o")
    def test_market_vocab_reaches_prompt_and_is_opt_in(self):
        """Tu vung thi truong phai di vao system prompt, va KHONG tu xuat hien khi khong truyen.

        Do tren mot CV that: co tu vung nay thi so ky nang khop duoc voi kho tang
        tu 13 len 26. Neu no am tham bien mat khoi prompt thi viec khop job te di
        ma khong co dau hieu nao bao.
        """
        mock_response = MagicMock()
        mock_response.choices = [MagicMock(message=MagicMock(content=json.dumps(MOCK_EXTRACTED)))]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        with patch("openai.OpenAI", return_value=mock_client):
            parse_cv("CV text", market_skills=["llm", "etl", "power bi"])
        sent = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert "llm, etl, power bi" in sent
        assert "GIỮ NGUYÊN" in sent

        mock_client.reset_mock()
        with patch("openai.OpenAI", return_value=mock_client):
            parse_cv("CV text")
        plain = mock_client.chat.completions.create.call_args.kwargs["messages"][0]["content"]
        assert "TỪ VỰNG KỸ NĂNG THỊ TRƯỜNG" not in plain

    @patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test")
    @patch("app.services.cv_parser.OPENAI_BASE_URL", "https://api.test.com/v1")
    def test_llm_returns_invalid_json(self):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content="not valid json {{{"))
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        with patch("openai.OpenAI", return_value=mock_client):
            result = parse_cv("some cv text")

        assert result.error == "LLM trả về JSON không hợp lệ"
        assert result.raw_text_length > 0

    @patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test")
    @patch("app.services.cv_parser.OPENAI_BASE_URL", "https://api.test.com/v1")
    def test_llm_timeout(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = TimeoutError("timed out")

        with patch("openai.OpenAI", return_value=mock_client):
            result = parse_cv("some cv text")

        assert result.error == "Không thể phân tích CV, thử lại sau"

    @patch("app.services.cv_parser.OPENAI_API_KEY", "sk-test")
    @patch("app.services.cv_parser.OPENAI_BASE_URL", "https://api.test.com/v1")
    def test_llm_sends_correct_messages(self):
        mock_response = MagicMock()
        mock_response.choices = [
            MagicMock(message=MagicMock(content=json.dumps(MOCK_EXTRACTED)))
        ]

        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_response

        cv_text = "John Doe - Python Developer"
        with patch("openai.OpenAI", return_value=mock_client):
            parse_cv(cv_text)

        call_kwargs = mock_client.chat.completions.create.call_args.kwargs
        assert call_kwargs["temperature"] == 0
        assert call_kwargs["response_format"] == {"type": "json_object"}
        messages = call_kwargs["messages"]
        assert messages[0]["role"] == "system"
        assert messages[1]["role"] == "user"
        assert cv_text in messages[1]["content"]


# ─── upload_to_s3 unit tests ─────────────────────────────

class TestUploadToS3:
    # S3 vars are lazily imported from config inside upload_to_s3,
    # so patch on app.core.config where they're defined
    @patch("app.core.config.S3_SECRET_KEY", "")
    def test_skips_when_no_secret(self):
        result = upload_to_s3(b"pdf", "test.pdf")
        assert result is None

    @patch("app.core.config.S3_SECRET_KEY", "secret")
    @patch("app.core.config.S3_ACCESS_KEY", "minioadmin")
    @patch("app.core.config.S3_ENDPOINT_URL", "http://minio:9000")
    @patch("app.core.config.S3_BUCKET_NAME", "test-bucket")
    def test_successful_upload(self):
        mock_minio = MagicMock()
        mock_minio.bucket_exists.return_value = True

        with patch("minio.Minio", return_value=mock_minio):
            url = upload_to_s3(b"fake-pdf-bytes", "cvs/test.pdf")

        assert url == "http://minio:9000/test-bucket/cvs/test.pdf"
        mock_minio.put_object.assert_called_once()
        call_kwargs = mock_minio.put_object.call_args
        assert call_kwargs[0][0] == "test-bucket"
        assert call_kwargs[0][1] == "cvs/test.pdf"

    @patch("app.core.config.S3_SECRET_KEY", "secret")
    @patch("app.core.config.S3_ACCESS_KEY", "minioadmin")
    @patch("app.core.config.S3_ENDPOINT_URL", "http://minio:9000")
    @patch("app.core.config.S3_BUCKET_NAME", "test-bucket")
    def test_creates_bucket_if_missing(self):
        mock_minio = MagicMock()
        mock_minio.bucket_exists.return_value = False

        with patch("minio.Minio", return_value=mock_minio):
            upload_to_s3(b"bytes", "test.pdf")

        mock_minio.make_bucket.assert_called_once_with("test-bucket")

    @patch("app.core.config.S3_SECRET_KEY", "secret")
    @patch("app.core.config.S3_ACCESS_KEY", "minioadmin")
    @patch("app.core.config.S3_ENDPOINT_URL", "http://minio:9000")
    @patch("app.core.config.S3_BUCKET_NAME", "test-bucket")
    def test_upload_failure_returns_none(self):
        with patch("minio.Minio", side_effect=Exception("connection refused")):
            url = upload_to_s3(b"bytes", "test.pdf")
        assert url is None

    @patch("app.core.config.S3_SECRET_KEY", "secret")
    @patch("app.core.config.S3_ACCESS_KEY", "minioadmin")
    @patch("app.core.config.S3_ENDPOINT_URL", "https://s3.example.com")
    @patch("app.core.config.S3_BUCKET_NAME", "bucket")
    def test_https_endpoint(self):
        mock_minio = MagicMock()
        mock_minio.bucket_exists.return_value = True

        with patch("minio.Minio", return_value=mock_minio) as mock_cls:
            upload_to_s3(b"bytes", "test.pdf")

        mock_cls.assert_called_once_with(
            "s3.example.com",
            access_key="minioadmin",
            secret_key="secret",
            secure=True,
        )


# ─── API endpoint tests ──────────────────────────────────

@pytest.mark.asyncio
async def test_upload_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/cv/upload")
    assert r.status_code == 401 or r.status_code == 403


@pytest.mark.asyncio
async def test_upload_rejects_non_pdf():
    user = _make_fake_user()
    _auth_override(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("resume.docx", b"fake", "application/msword")},
        )
    assert r.status_code == 400
    assert "PDF" in r.json()["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_empty_file():
    user = _make_fake_user()
    _auth_override(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("resume.pdf", b"", "application/pdf")},
        )
    assert r.status_code == 400
    assert "trống" in r.json()["detail"]


@pytest.mark.asyncio
async def test_upload_rejects_oversized_file():
    user = _make_fake_user()
    _auth_override(user)

    big_bytes = b"x" * (6 * 1024 * 1024)  # 6 MB
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("resume.pdf", big_bytes, "application/pdf")},
        )
    assert r.status_code == 400
    assert "lớn" in r.json()["detail"]


@pytest.mark.asyncio
@patch("app.api.cv.upload_to_s3", return_value=None)
@patch("app.api.cv.parse_cv", return_value=CvExtractResult(data=MOCK_EXTRACTED, raw_text_length=500))
@patch("app.api.cv.extract_text", return_value="fake cv text")
async def test_upload_success(mock_extract, mock_parse, mock_s3):
    user = _make_fake_user()
    _auth_override(user)

    fake_pdf = b"%PDF-1.4 fake content"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("cv.pdf", fake_pdf, "application/pdf")},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["extracted"]["full_name"] == "Nguyen Minh Bao"
    assert body["extracted"]["experience_level"] == "experienced"
    assert "python" in body["extracted"]["skills"]
    assert body["raw_text_length"] == 500
    assert body["error"] is None


@pytest.mark.asyncio
@patch("app.api.cv.upload_to_s3", return_value=None)
@patch("app.api.cv.parse_cv", return_value=CvExtractResult(error="OPENAI_API_KEY not configured"))
@patch("app.api.cv.extract_text", return_value="some text")
async def test_upload_returns_llm_error(mock_extract, mock_parse, mock_s3):
    user = _make_fake_user()
    _auth_override(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("cv.pdf", b"%PDF fake", "application/pdf")},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["error"] == "OPENAI_API_KEY not configured"
    assert body["extracted"] == {}


@pytest.mark.asyncio
@patch("app.api.cv.upload_to_s3", return_value="http://minio:9000/bucket/cvs/test.pdf")
@patch("app.api.cv.parse_cv", return_value=CvExtractResult(data=MOCK_EXTRACTED, raw_text_length=500))
@patch("app.api.cv.extract_text", return_value="fake cv text")
async def test_upload_saves_s3_url(mock_extract, mock_parse, mock_s3):
    user = _make_fake_user()
    _auth_override(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("cv.pdf", b"%PDF fake", "application/pdf")},
        )
    assert r.status_code == 200
    mock_s3.assert_called_once()


@pytest.mark.asyncio
@patch("app.api.cv.upload_to_s3", return_value=None)
@patch("app.api.cv.parse_cv", return_value=CvExtractResult(data=MOCK_EXTRACTED, raw_text_length=500))
@patch("app.api.cv.extract_text", return_value="extracted cv plain text")
async def test_upload_persists_cv_text(mock_extract, mock_parse, mock_s3):
    user = _make_fake_user()
    _auth_override(user)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/cv/upload",
            files={"file": ("cv.pdf", b"%PDF fake", "application/pdf")},
        )
    assert r.status_code == 200
    # The endpoint must persist the extracted text on the user so AI features can read it.
    assert user.cv_text == "extracted cv plain text"
