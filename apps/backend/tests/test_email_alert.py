"""End-to-end tests for email alert feature.

Tests cover:
1. Email service (Resend API integration)
2. Email alert API endpoints (subscribe/unsubscribe/status)
3. Dispatch loop with email channel
4. HTML email content generation
5. Dedup with email channel
"""
from __future__ import annotations

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient, Response

from app.core.database import get_db
from app.core.security import get_current_user
from app.main import app
from app.models.alert_log import AlertLog
from app.models.telegram import AlertSubscription
from app.models.user import User
from app.services.email import (
    EmailResult,
    _build_job_alert_html,
    send_job_alert_email,
)
from app.services.job_alert import EMAIL_ALERT_TYPE
from app.services.job_matcher import MatchedJob


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _make_user(**overrides):
    from app.models.user import User

    defaults = dict(
        id=uuid4(),
        email="test@example.com",
        hashed_password="$2b$12$fake",
        full_name="Test User",
        skills=["Python"],
        desired_salary_min=20_000_000,
        desired_salary_max=40_000_000,
        preferred_cities=["Ho Chi Minh"],
        desired_titles=["AI Engineer"],
        is_active=True,
        is_admin=False,
        subscription_tier="free",
        experience_level="senior",
        university=None,
        graduation_year=None,
        open_to_internship=False,
        part_time_ok=False,
        created_at=datetime(2026, 1, 15, 10, 0, 0),
        updated_at=datetime(2026, 1, 15, 10, 0, 0),
    )
    defaults.update(overrides)
    return MagicMock(spec=User, **defaults)


@pytest.fixture
def fake_user():
    return _make_user()


@pytest.fixture
def fake_db():
    db = AsyncMock()
    db.get = AsyncMock(return_value=None)
    db.execute = AsyncMock()
    db.commit = AsyncMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def override_deps(fake_user, fake_db):
    app.dependency_overrides[get_current_user] = lambda: fake_user
    app.dependency_overrides[get_db] = lambda: fake_db
    yield
    app.dependency_overrides.clear()


def _sample_jobs(n=2):
    return [
        MatchedJob(
            source="vietnamworks",
            source_job_id=f"job-{i}",
            title=f"Job Title {i}",
            company_name=f"Company {i}",
            city_canonical="Ho Chi Minh",
            job_level="Senior",
            salary_m=30.0 + i * 5,
            score=75.0 + i * 5,
            source_url=f"https://example.com/job/{i}",
        )
        for i in range(1, n + 1)
    ]


# ═══════════════════════════════════════════════
# 1. Email Service Unit Tests
# ═══════════════════════════════════════════════

class TestEmailService:
    """Tests for app.services.email module."""

    @pytest.mark.asyncio
    async def test_send_email_success(self):
        """Resend API returns 200 → success."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "re_msg_123"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.email.RESEND_API_KEY", "re_test_key"):
                result = await send_job_alert_email(
                    to="user@example.com",
                    user_name="Test User",
                    jobs=_sample_jobs(),
                )

        assert result.success is True
        assert result.message_id == "re_msg_123"
        assert result.error is None
        mock_client.post.assert_called_once()
        call_args = mock_client.post.call_args
        assert call_args[0][0] == "https://api.resend.com/emails"
        body = call_args[1]["json"]
        assert body["to"] == ["user@example.com"]
        assert "TalentPulse Alert" in body["subject"]
        # Doc gia tri app THUC SU chay voi, thay vi chep lai hang so o day.
        # RESEND_FROM_EMAIL doc tu bien moi truong (config.py:63); test hardcode
        # gia tri mac dinh se DO ngay khi moi truong dat gia tri khac — dung nhu
        # da xay ra: container dat "alerts@talentpuse.io.vn" (dia chi tran) trong
        # khi mac dinh la "TalentPulse <alerts@talentpuse.io.vn>".
        # Cung ly le voi TELEGRAM_WEBHOOK_SECRET o test_job_alert.py.
        from app.core.config import RESEND_FROM_EMAIL

        assert body["from"] == RESEND_FROM_EMAIL
        assert "<html>" in body["html"].lower() or "<!doctype" in body["html"].lower()

    @pytest.mark.asyncio
    async def test_send_email_api_error(self):
        """Resend API returns 422 → failure."""
        mock_response = MagicMock()
        mock_response.status_code = 422
        mock_response.text = '{"error":"Invalid from address"}'

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.email.RESEND_API_KEY", "re_test_key"):
                result = await send_job_alert_email(
                    to="user@example.com",
                    user_name="Test",
                    jobs=_sample_jobs(1),
                )

        assert result.success is False
        assert "422" in result.error

    @pytest.mark.asyncio
    async def test_send_email_no_api_key(self):
        """Missing API key → skip with error."""
        with patch("app.services.email.RESEND_API_KEY", ""):
            result = await send_job_alert_email(
                to="user@example.com",
                user_name="Test",
                jobs=_sample_jobs(1),
            )

        assert result.success is False
        assert "not configured" in result.error

    @pytest.mark.asyncio
    async def test_send_email_empty_jobs(self):
        """Empty jobs list → skip."""
        with patch("app.services.email.RESEND_API_KEY", "re_test"):
            result = await send_job_alert_email(
                to="user@example.com",
                user_name="Test",
                jobs=[],
            )
        assert result.success is False
        assert "No jobs" in result.error

    @pytest.mark.asyncio
    async def test_send_email_network_error(self):
        """Network exception → failure with error message."""
        mock_client = AsyncMock()
        mock_client.post = AsyncMock(side_effect=Exception("Connection refused"))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.email.RESEND_API_KEY", "re_test_key"):
                result = await send_job_alert_email(
                    to="user@example.com",
                    user_name="Test",
                    jobs=_sample_jobs(1),
                )

        assert result.success is False
        assert "Connection refused" in result.error

    @pytest.mark.asyncio
    async def test_send_email_201_success(self):
        """Resend sometimes returns 201 → also success."""
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": "re_msg_456"}

        mock_client = AsyncMock()
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.httpx.AsyncClient", return_value=mock_client):
            with patch("app.services.email.RESEND_API_KEY", "re_test_key"):
                result = await send_job_alert_email(
                    to="user@example.com",
                    user_name="Test",
                    jobs=_sample_jobs(1),
                )

        assert result.success is True
        assert result.message_id == "re_msg_456"


# ═══════════════════════════════════════════════
# 2. HTML Email Content Tests
# ═══════════════════════════════════════════════

class TestEmailHTML:
    """Tests for _build_job_alert_html."""

    def test_html_contains_user_name(self):
        html = _build_job_alert_html("Nguyen Van A", _sample_jobs(1))
        assert "Nguyen Van A" in html

    def test_html_contains_job_count(self):
        jobs = _sample_jobs(3)
        html = _build_job_alert_html("Test", jobs)
        assert "3" in html  # "3 viec lam moi"

    def test_html_contains_job_title(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "Job Title 1" in html

    def test_html_contains_company(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "Company 1" in html

    def test_html_contains_salary(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "35 triệu" in html

    def test_html_contains_city(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "Ho Chi Minh" in html

    def test_html_contains_link(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "https://example.com/job/1" in html

    def test_html_contains_profile_link(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "talentpuse.io.vn/profile" in html

    def test_html_contains_score(self):
        jobs = _sample_jobs(1)
        html = _build_job_alert_html("Test", jobs)
        assert "80%" in html  # score=80.0

    def test_html_no_salary_when_none(self):
        jobs = [MatchedJob(source="vietnamworks", source_job_id="x", title="Dev",
                           company_name="Co", salary_m=None)]
        html = _build_job_alert_html("Test", jobs)
        assert "trieu" not in html

    def test_html_with_multiple_jobs(self):
        jobs = _sample_jobs(3)
        html = _build_job_alert_html("Test", jobs)
        assert "Job Title 1" in html
        assert "Job Title 2" in html
        assert "Job Title 3" in html

    def test_html_is_valid_structure(self):
        html = _build_job_alert_html("Test", _sample_jobs(1))
        assert html.startswith("<!DOCTYPE")
        assert "</html>" in html
        assert "<body" in html


# ═══════════════════════════════════════════════
# 3. Email Alert API Tests
# ═══════════════════════════════════════════════

class TestEmailAlertAPI:
    """Tests for /api/email/alerts endpoints."""

    @pytest.mark.asyncio
    async def test_get_status_not_subscribed(self, override_deps, fake_db):
        """User not subscribed → enabled=False."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        fake_db.execute.return_value = mock_result

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/email/alerts/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is False
        assert data["email"] == "test@example.com"

    @pytest.mark.asyncio
    async def test_get_status_subscribed(self, override_deps, fake_db):
        """User subscribed → enabled=True."""
        mock_sub = MagicMock()
        mock_sub.enabled = True
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_sub
        fake_db.execute.return_value = mock_result

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.get("/api/email/alerts/status")

        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is True

    @pytest.mark.asyncio
    async def test_subscribe_creates_subscription(self, override_deps, fake_db):
        """Subscribe → creates AlertSubscription."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        fake_db.execute.return_value = mock_result

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/email/alerts/subscribe")

        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] is True
        assert data["email"] == "test@example.com"
        fake_db.add.assert_called_once()
        added_obj = fake_db.add.call_args[0][0]
        assert added_obj.alert_type == EMAIL_ALERT_TYPE
        assert added_obj.enabled is True
        fake_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_subscribe_enables_existing(self, override_deps, fake_db):
        """Subscribe when already exists → enables it."""
        mock_sub = MagicMock()
        mock_sub.enabled = False
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_sub
        fake_db.execute.return_value = mock_result

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/email/alerts/subscribe")

        assert resp.status_code == 200
        assert resp.json()["enabled"] is True
        assert mock_sub.enabled is True
        fake_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_unsubscribe_disables(self, override_deps, fake_db):
        """Unsubscribe → sets enabled=False."""
        mock_sub = MagicMock()
        mock_sub.enabled = True
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_sub
        fake_db.execute.return_value = mock_result

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/email/alerts/unsubscribe")

        assert resp.status_code == 200
        assert resp.json()["enabled"] is False
        assert mock_sub.enabled is False

    @pytest.mark.asyncio
    async def test_unsubscribe_no_existing(self, override_deps, fake_db):
        """Unsubscribe when never subscribed → still returns enabled=False."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        fake_db.execute.return_value = mock_result

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/api/email/alerts/unsubscribe")

        assert resp.status_code == 200
        assert resp.json()["enabled"] is False

    @pytest.mark.asyncio
    async def test_requires_auth(self, fake_db):
        """No auth → 401/403."""
        app.dependency_overrides[get_db] = lambda: fake_db
        try:
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                resp = await client.get("/api/email/alerts/status")
            assert resp.status_code in (401, 403)
        finally:
            app.dependency_overrides.clear()


# ═══════════════════════════════════════════════
# 4. Dispatch Integration Tests
# ═══════════════════════════════════════════════

class TestDispatchWithEmail:
    """Tests for dispatch_alerts with email channel."""

    @pytest.mark.asyncio
    async def test_dispatch_sends_email_when_subscribed(self):
        """User with email subscription → email sent + email alert logs created."""
        user = _make_user(email="sub@example.com")
        jobs = _sample_jobs(2)

        with (
            patch("app.services.job_alert.select") as mock_select,
            patch("app.services.job_alert.JobMatcher") as MockMatcher,
            patch("app.services.job_alert.send_job_alert_email", new_callable=AsyncMock) as mock_send,
            patch("app.services.job_alert._send_message", new_callable=AsyncMock),
        ):
            # Mock DB query returning user + no telegram
            mock_result = MagicMock()
            mock_result.all.return_value = [(user, None)]
            mock_select.return_value = MagicMock()

            mock_db = AsyncMock()
            mock_db.execute = AsyncMock()

            # Call 1: user query
            # Call 2+: email subscription check
            email_sub = MagicMock()
            email_sub.scalar_one_or_none = MagicMock(return_value=email_sub)

            call_count = [0]
            async def mock_execute(*args, **kwargs):
                call_count[0] += 1
                if call_count[0] == 1:
                    # user query
                    r = MagicMock()
                    r.all.return_value = [(user, None)]
                    return r
                else:
                    # email subscription check
                    r = MagicMock()
                    r.scalar_one_or_none.return_value = email_sub
                    return r

            mock_db.execute = mock_execute
            mock_db.commit = AsyncMock()
            mock_db.rollback = AsyncMock()
            mock_db.flush = AsyncMock()
            mock_db.add = MagicMock()

            # Mock matcher
            matcher = MagicMock()
            matcher.find_jobs = AsyncMock(return_value=jobs)
            matcher.log_and_send = AsyncMock(return_value=2)
            MockMatcher.return_value = matcher

            mock_send.return_value = EmailResult(success=True, message_id="re_123")

            from app.services.job_alert import dispatch_alerts
            total = await dispatch_alerts(mock_db)

        assert total == 2
        # `user_id` la bat buoc: no sinh ra token huy nhan email cho header
        # List-Unsubscribe (JA-22). Thieu no thi mail di ma khong co duong huy.
        mock_send.assert_called_once_with(
            to="sub@example.com",
            user_name="Test User",
            jobs=jobs,
            user_id=user.id,
        )

    @pytest.mark.asyncio
    async def test_dispatch_skips_email_when_not_subscribed(self):
        """User without email subscription → no email sent.

        User cung khong co telegram (chat_id=None) nen khong co kenh nao de gui:
        dispatch bo qua toan bo (JA-52) — khong gui email, khong ghi marker gi.
        """
        user = _make_user(email="nosub@example.com")
        jobs = _sample_jobs(1)

        mock_db = AsyncMock()

        call_count = [0]
        async def mock_execute(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # user query
                r = MagicMock()
                r.all.return_value = [(user, None)]
                return r
            else:
                # email subscription check
                r = MagicMock()
                r.scalar_one_or_none.return_value = None  # No subscription
                return r

        mock_db.execute = mock_execute
        mock_db.commit = AsyncMock()
        mock_db.rollback = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()

        with (
            patch("app.services.job_alert.JobMatcher") as MockMatcher,
            patch("app.services.job_alert.send_job_alert_email", new_callable=AsyncMock) as mock_send,
            patch("app.services.job_alert._send_message", new_callable=AsyncMock),
        ):
            matcher = MagicMock()
            matcher.find_jobs = AsyncMock(return_value=jobs)
            matcher.log_and_send = AsyncMock(return_value=1)
            MockMatcher.return_value = matcher

            from app.services.job_alert import dispatch_alerts
            total = await dispatch_alerts(mock_db)

        assert total == 0, "user khong co kenh nao thi khong dispatch gi ca"
        mock_send.assert_not_called()

    @pytest.mark.asyncio
    async def test_dispatch_email_failure_doesnt_block(self):
        """Email send fails → dispatch still succeeds for telegram/website."""
        user = _make_user(email="fail@example.com")
        jobs = _sample_jobs(1)

        mock_db = AsyncMock()

        call_count = [0]
        async def mock_execute(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # user query
                r = MagicMock()
                r.all.return_value = [(user, None)]
                return r
            else:
                # email subscription check
                r = MagicMock()
                r.scalar_one_or_none.return_value = MagicMock()  # subscribed
                return r

        mock_db.execute = mock_execute
        mock_db.commit = AsyncMock()
        mock_db.rollback = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()

        with (
            patch("app.services.job_alert.JobMatcher") as MockMatcher,
            patch("app.services.job_alert.send_job_alert_email", new_callable=AsyncMock) as mock_send,
            patch("app.services.job_alert._send_message", new_callable=AsyncMock),
        ):
            matcher = MagicMock()
            matcher.find_jobs = AsyncMock(return_value=jobs)
            matcher.log_and_send = AsyncMock(return_value=1)
            MockMatcher.return_value = matcher

            mock_send.return_value = EmailResult(success=False, error="API error")

            from app.services.job_alert import dispatch_alerts
            total = await dispatch_alerts(mock_db)

        assert total == 1  # Still counted from website/telegram

    @pytest.mark.asyncio
    async def test_dispatch_email_exception_handled(self):
        """Email throws exception → dispatch continues."""
        user = _make_user(email="crash@example.com")
        jobs = _sample_jobs(1)

        mock_db = AsyncMock()

        call_count = [0]
        async def mock_execute(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # user query
                r = MagicMock()
                r.all.return_value = [(user, None)]
                return r
            else:
                # email subscription check
                r = MagicMock()
                r.scalar_one_or_none.return_value = MagicMock()
                return r

        mock_db.execute = mock_execute
        mock_db.commit = AsyncMock()
        mock_db.rollback = AsyncMock()
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()

        with (
            patch("app.services.job_alert.JobMatcher") as MockMatcher,
            patch("app.services.job_alert.send_job_alert_email", new_callable=AsyncMock, side_effect=Exception("Network error")),
            patch("app.services.job_alert._send_message", new_callable=AsyncMock),
        ):
            matcher = MagicMock()
            matcher.find_jobs = AsyncMock(return_value=jobs)
            matcher.log_and_send = AsyncMock(return_value=1)
            MockMatcher.return_value = matcher

            from app.services.job_alert import dispatch_alerts
            total = await dispatch_alerts(mock_db)

        assert total == 1  # Not blocked by email exception


# ═══════════════════════════════════════════════
# 5. AlertSubscription Integration
# ═══════════════════════════════════════════════

class TestAlertSubscription:
    """Tests for AlertSubscription with email alert type."""

    def test_email_alert_type_constant(self):
        assert EMAIL_ALERT_TYPE == "email_job_match"

    @pytest.mark.asyncio
    async def test_subscribe_then_check_status(self, override_deps, fake_db):
        """Full flow: subscribe → check status shows enabled."""
        # First call: subscribe (no existing sub)
        mock_result_none = MagicMock()
        mock_result_none.scalar_one_or_none.return_value = None

        # Second call: status (sub exists)
        mock_sub = MagicMock()
        mock_sub.enabled = True
        mock_result_exists = MagicMock()
        mock_result_exists.scalar_one_or_none.return_value = mock_sub

        fake_db.execute = AsyncMock(side_effect=[mock_result_none, mock_result_exists])

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Subscribe
            resp1 = await client.post("/api/email/alerts/subscribe")
            assert resp1.status_code == 200
            assert resp1.json()["enabled"] is True

        # Reset for status check
        fake_db.execute = AsyncMock(return_value=mock_result_exists)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Check status
            resp2 = await client.get("/api/email/alerts/status")
            assert resp2.status_code == 200
            assert resp2.json()["enabled"] is True


# ═══════════════════════════════════════════════
# 6. AlertLog Channel Tests
# ═══════════════════════════════════════════════

class TestAlertLogEmailChannel:
    """Tests verifying AlertLog entries use 'email' channel correctly."""

    def test_alert_log_supports_email_channel(self):
        """AlertLog model accepts channel='email'."""
        log = AlertLog(
            user_id=uuid4(),
            source_job_id="test-123",
            channel="email",
        )
        assert log.channel == "email"

    def test_alert_log_default_channel_is_telegram(self):
        """AlertLog model has server_default='telegram' on channel column."""
        from sqlalchemy import inspect as sa_inspect
        from app.models.alert_log import AlertLog

        columns = {c.name: c for c in sa_inspect(AlertLog).columns}
        assert columns["channel"].server_default.arg == "telegram"

    def test_alert_log_website_channel(self):
        log = AlertLog(
            user_id=uuid4(),
            source_job_id="test-789",
            channel="website",
        )
        assert log.channel == "website"

@pytest.mark.asyncio
async def test_signup_tu_dong_bat_email_alert(client, db_session):
    """Email alert mac dinh ON khi dang ky (quyet dinh 2026-08-07).

    Truoc day la opt-in: user moi khong co subscription email_job_match nao
    nen khong bao gio nhan email. Gio create_user phai tao san dong enabled=true.
    """
    from sqlalchemy import select

    from app.models.telegram import AlertSubscription
    from app.models.user import User

    email = f"default-on-{uuid4()}@example.com"
    r = await client.post("/api/auth/signup", json={
        "email": email,
        "password": "strongpass123",
        "full_name": "Nguyen Mac Dinh",
    })
    assert r.status_code == 201

    try:
        user = (await db_session.execute(
            select(User).where(User.email == email)
        )).scalar_one()
        sub = (await db_session.execute(
            select(AlertSubscription).where(
                AlertSubscription.user_id == user.id,
                AlertSubscription.alert_type == "email_job_match",
            )
        )).scalar_one_or_none()
        assert sub is not None, "signup phai tao san subscription email"
        assert sub.enabled is True, "subscription phai bat san"
    finally:
        row = (await db_session.execute(
            select(User).where(User.email == email)
        )).scalar_one_or_none()
        if row is not None:
            await db_session.delete(row)
            await db_session.commit()

