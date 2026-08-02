"""Tests for job alert matching + dispatch."""
from __future__ import annotations

import re
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db
from app.main import app
from app.models.user import User
from app.services.job_matcher import (
    LEVEL_MAP,
    ALERT_LIMIT,
    STUDENT_ALERT_LIMIT,
    DEDUP_CHANNEL,
    JobMatcher,
    MatchedJob,
    _format_job_message,
)


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

async def _fake_get_db():
    yield AsyncMock()


@pytest.fixture(autouse=True)
def _override_db():
    app.dependency_overrides[get_db] = _fake_get_db
    yield
    app.dependency_overrides.clear()


# Read the secret the app actually runs with rather than restating it here — a
# test that hardcodes the value keeps passing after the real secret is rotated.
from app.core.config import TELEGRAM_WEBHOOK_SECRET  # noqa: E402

CRON_HEADERS = {"X-Cron-Secret": TELEGRAM_WEBHOOK_SECRET}


def _make_user(**overrides) -> MagicMock:
    defaults = dict(
        id=uuid4(),
        skills=["Python"],
        desired_titles=["AI Engineer"],
        preferred_cities=["HCMC"],
        desired_salary_min=None,
        experience_level=None,
    )
    defaults.update(overrides)
    user = MagicMock(spec=User)
    for k, v in defaults.items():
        setattr(user, k, v)
    return user


def _job_dict(**overrides) -> dict:
    defaults = dict(
        source="vietnamworks",
        source_job_id="123",
        title="AI Engineer",
        company_name="FPT",
        city_canonical="HCMC",
        job_level="Senior",
        job_category="AI Engineer",
        salary_m=30.0,
        source_url=None,
        posted_at=None,
        score=72.5,
    )
    defaults.update(overrides)
    return defaults


# ─────────────────────────────────────────────
# POST /api/telegram/alerts/dispatch
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dispatch_requires_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/telegram/alerts/dispatch")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dispatch_wrong_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/telegram/alerts/dispatch",
            headers={"X-Cron-Secret": "wrong"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dispatch_success():
    with patch("app.api.telegram.dispatch_alerts", new_callable=AsyncMock, return_value=5):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/alerts/dispatch",
                headers=CRON_HEADERS,
            )

    assert r.status_code == 200
    assert r.json() == {"dispatched": 5}


@pytest.mark.asyncio
async def test_dispatch_zero():
    with patch("app.api.telegram.dispatch_alerts", new_callable=AsyncMock, return_value=0):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/telegram/alerts/dispatch",
                headers=CRON_HEADERS,
            )

    assert r.status_code == 200
    assert r.json() == {"dispatched": 0}


# ─────────────────────────────────────────────
# POST /api/admin/alerts/dispatch-internal
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_internal_dispatch_no_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/admin/alerts/dispatch-internal")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_internal_dispatch_wrong_secret():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/admin/alerts/dispatch-internal",
            headers={"X-Webhook-Secret": "bad-secret"},
        )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_internal_dispatch_success():
    with patch("app.api.admin.dispatch_alerts", new_callable=AsyncMock, return_value=12):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/admin/alerts/dispatch-internal",
                headers={"X-Webhook-Secret": TELEGRAM_WEBHOOK_SECRET},
            )

    assert r.status_code == 200
    assert r.json() == {"dispatched": 12}


# ─────────────────────────────────────────────
# format_job_message
# ─────────────────────────────────────────────

def test_format_single_job():
    jobs = [MatchedJob(**_job_dict())]
    msg = _format_job_message(jobs)
    assert "việc làm" in msg
    assert "AI Engineer" in msg
    assert "FPT" in msg
    assert "HCMC" in msg
    assert "30 triệu" in msg
    assert "VietnamWorks" in msg


def test_format_multiple_jobs():
    jobs = [
        MatchedJob(**_job_dict()),
        MatchedJob(
            source="itviec", source_job_id="abc-slug",
            title="AI Engineer", company_name="Grab",
            city_canonical="Hanoi", salary_m=None, score=40.0,
        ),
    ]
    msg = _format_job_message(jobs)
    assert "việc làm" in msg
    assert "AI Engineer" in msg
    assert "VietnamWorks" in msg
    assert "ITviec" in msg


def test_format_no_salary():
    jobs = [MatchedJob(source="vietnamworks", source_job_id="99", title="Backend Dev",
                        company_name="Startup", salary_m=None)]
    msg = _format_job_message(jobs)
    assert "Backend Dev" in msg
    assert "triệu" not in msg


def test_format_with_level():
    jobs = [MatchedJob(**_job_dict(job_level="Mid-level", score=80.0))]
    msg = _format_job_message(jobs)
    assert "Mid-level" in msg
    assert "Bosch" not in msg  # default company is FPT
    assert "80%" in msg


def test_format_no_level():
    jobs = [MatchedJob(source="itviec", source_job_id="devops-engineer",
                        title="DevOps Engineer", company_name="TechCorp",
                        city_canonical="Hanoi", salary_m=20.0, score=45.0)]
    msg = _format_job_message(jobs)
    assert "DevOps Engineer" in msg
    assert "ITviec" in msg


def test_format_uses_source_url():
    jobs = [MatchedJob(
        source="itviec", source_job_id="3715", title="Data Engineer",
        company_name="TechCo", city_canonical="HCMC",
        source_url="https://itviec.com/job/data-engineer-aws-gcp-up-to-2700-3715",
    )]
    msg = _format_job_message(jobs)
    assert "itviec.com/job/data-engineer-aws-gcp-up-to-2700-3715" in msg


def test_format_fallback_without_source_url():
    jobs = [MatchedJob(source="itviec", source_job_id="999",
                        title="DevOps", company_name="X")]
    msg = _format_job_message(jobs)
    assert "itviec.com" in msg


# ─────────────────────────────────────────────
# LEVEL_MAP correctness
# ─────────────────────────────────────────────

CANONICAL_LEVELS = {"Intern/Student", "Fresher/Entry level", "Mid-level", "Senior", "Manager", "Director+"}


class TestLevelMap:
    def test_all_values_are_canonical(self):
        for level_key, levels in LEVEL_MAP.items():
            for lv in levels:
                assert lv in CANONICAL_LEVELS, (
                    f"LEVEL_MAP['{level_key}'] contains non-canonical value '{lv}'"
                )

    def test_no_dead_raw_values(self):
        dead = {"Experienced (non-manager)", "Not Applicable", "Mid-Senior level",
                "Associate", "Entry level", "Internship", "Executive", "Director"}
        for level_key, levels in LEVEL_MAP.items():
            for lv in levels:
                assert lv not in dead

    def test_student_gets_intern_and_fresher(self):
        assert LEVEL_MAP["student"] == ["Intern/Student", "Fresher/Entry level"]

    def test_fresher_gets_entry_and_mid(self):
        assert LEVEL_MAP["fresher"] == ["Fresher/Entry level", "Mid-level"]

    def test_experienced_gets_mid_and_senior(self):
        assert LEVEL_MAP["experienced"] == ["Mid-level", "Senior"]

    def test_manager_gets_senior_manager_director(self):
        assert LEVEL_MAP["manager"] == ["Senior", "Manager", "Director+"]


# ─────────────────────────────────────────────
# JobMatcher SQL generation
# ─────────────────────────────────────────────

def _make_fake_db(captured: dict):
    class FakeDB:
        async def execute(self, sql, params=None):
            captured["sql"] = str(sql)
            captured["params"] = params

            class R:
                def all(self):
                    return []

                @property
                def _mapping(self):
                    return {}

            return R()

        def add(self, obj):
            pass

        async def flush(self):
            pass

    return FakeDB()


def _extract_level_clause(sql_text: str) -> str:
    m = re.search(r"AND \(fct_jobs_daily\.job_level = ANY\((.*?)\)", sql_text)
    return m.group(1) if m else ""


@pytest.mark.asyncio
async def test_student_sql_has_level_filter():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="student", desired_titles=["Data Engineer"]))

    sql = captured["sql"]
    assert "job_level = ANY" in sql
    assert "is_active = true" in sql


@pytest.mark.asyncio
async def test_experienced_sql_has_level_filter():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="experienced", desired_titles=["Data Analyst"]))

    sql = captured["sql"]
    assert "job_level = ANY" in sql


@pytest.mark.asyncio
async def test_no_experience_level_no_filter():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level=None))

    sql = captured["sql"]
    assert "fct_jobs_daily" in sql
    # No level filter — just is_active + not already alerted
    assert "job_level" not in sql or "job_level = ANY" not in sql


@pytest.mark.asyncio
async def test_student_sql_has_hard_title_filter():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="student", desired_titles=["AI Engineer"]))

    sql = captured["sql"]
    assert "LIKE" in sql  # ORM uses LIKE for ilike


@pytest.mark.asyncio
async def test_student_sql_no_limit_3():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="student", desired_titles=["Data Engineer"]))

    sql = captured["sql"]
    # ORM uses bound params for LIMIT, so just check LIMIT exists
    assert "LIMIT" in sql
    assert "LIMIT 3" not in sql  # hardcoded 3 should not appear


@pytest.mark.asyncio
async def test_student_no_titles_returns_empty():
    matcher = JobMatcher(_make_fake_db({}))
    result = await matcher.find_jobs(_make_user(experience_level="student", desired_titles=[]))
    assert result == []


@pytest.mark.asyncio
async def test_student_sql_rejects_senior_levels():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="student", desired_titles=["Data Analyst"]))

    sql = captured["sql"]
    assert "job_level = ANY" in sql
    assert "score" not in sql.lower()  # no scoring for students


@pytest.mark.asyncio
async def test_non_student_still_uses_scoring():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="experienced",
                                        desired_titles=["Data Analyst"],
                                        preferred_cities=["HCMC"]))

    sql = captured["sql"]
    assert "score" in sql.lower()
    assert "LIMIT" in sql


@pytest.mark.asyncio
async def test_manager_sql_rejects_intern_jobs():
    captured = {}
    matcher = JobMatcher(_make_fake_db(captured))
    await matcher.find_jobs(_make_user(experience_level="manager"))

    sql = captured["sql"]
    assert "job_level = ANY" in sql
    assert "score" in sql.lower()  # manager uses scoring
    assert "LIMIT" in sql


# ─────────────────────────────────────────────
# log_and_send dedup
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_log_and_send_skips_already_alerted():
    """Jobs already in alert_logs should not be sent again."""
    alerted_ids = {"job-1", "job-2"}
    jobs = [
        MatchedJob(source="vietnamworks", source_job_id="job-1", title="A"),
        MatchedJob(source="vietnamworks", source_job_id="job-3", title="B"),
    ]

    added = []

    class FakeDB:
        async def execute(self, sql, params=None):
            class R:
                def all(self):
                    # (job_source, source_job_id) — dedup so theo tuple, khong
                    # con so theo id tran (JA-05).
                    return [("vietnamworks", "job-1"), ("vietnamworks", "job-2")]
            return R()

        def add(self, obj):
            added.append(obj)

        async def flush(self):
            pass

        async def commit(self):
            pass

    send_fn = AsyncMock()
    matcher = JobMatcher(FakeDB())
    sent = await matcher.log_and_send(_make_user(), jobs, chat_id=123, send_fn=send_fn)

    assert sent == 1
    assert len(added) == 2  # 1 website + 1 telegram for job-3 only
    assert all(a.source_job_id == "job-3" for a in added)
    send_fn.assert_called_once()


class _EmptyAlertDB:
    """FakeDB chua tung alert job nao — dung cho cac test ghi ban ghi moi."""

    def __init__(self):
        self.added = []

    async def execute(self, sql, params=None):
        class R:
            def all(self):
                return []
        return R()

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        # `log_and_send` commit truoc moi lan goi mang de tra connection ve
        # pool trong luc cho Telegram/Resend (JA-15).
        pass


@pytest.mark.asyncio
async def test_log_and_send_records_telegram_failure():
    """Telegram gui loi PHAI de lai ban ghi status='failed'.

    Truoc day nhanh except chi goi logger.exception roi nuot. Nhung dong 'website'
    da duoc ghi TRUOC do, nen job bi danh dau la da-alert => lan chay sau dedup
    loai no ra vinh vien: push Telegram mat han, khong dau vet, va khong retry
    duoc (co che retry o admin.py chi phuc vu channel='email').

    Do chinh la ly do 100/100 ban ghi trong DB that deu status='sent' va
    retry_count=0 — khong phai vi hoan hao ma vi that bai khong duoc ghi lai.
    """
    jobs = [MatchedJob(source="vietnamworks", source_job_id="job-9", title="A")]
    db = _EmptyAlertDB()
    send_fn = AsyncMock(side_effect=RuntimeError("telegram 502 bad gateway"))

    matcher = JobMatcher(db)
    sent = await matcher.log_and_send(
        _make_user(), jobs, chat_id=123, send_fn=send_fn, source="background_loop"
    )

    # Van tinh la da alert (dong website da ghi) — nhung that bai phai hien ro.
    assert sent == 1
    telegram_rows = [a for a in db.added if a.channel == "telegram"]
    assert len(telegram_rows) == 1, "phai co dong telegram ghi lai that bai"
    assert telegram_rows[0].status == "failed"
    assert "telegram 502 bad gateway" in (telegram_rows[0].error_message or "")


@pytest.mark.asyncio
async def test_log_and_send_records_source_on_every_row():
    """Moi dong alert PHAI ghi `source`.

    log_and_send truoc day khong nhan tham so `source`, trong khi nhanh email o
    job_alert.py co truyen. Hau qua do duoc tren DB that: 57/59 dong website va
    6/7 dong telegram co source = NULL, nen trang admin dispatch-history/stats
    (gom nhom theo source) khong biet gi ve 63% so alert da gui.
    """
    jobs = [MatchedJob(source="vietnamworks", source_job_id="job-9", title="A")]
    db = _EmptyAlertDB()
    send_fn = AsyncMock()

    matcher = JobMatcher(db)
    await matcher.log_and_send(
        _make_user(), jobs, chat_id=123, send_fn=send_fn, source="background_loop"
    )

    assert len(db.added) == 2  # website + telegram
    assert {a.channel for a in db.added} == {"website", "telegram"}
    assert all(a.source == "background_loop" for a in db.added), \
        f"source bi bo trong: {[(a.channel, a.source) for a in db.added]}"


# ─────────────────────────────────────────────
# Multi-day dispatch simulation
# ─────────────────────────────────────────────

class _SimDB:
    """Stateful fake DB that accumulates alert_log entries across dispatch cycles.

    Simulates a real database: `execute()` returns whatever alert_logs have been
    `add()`-ed so far.  This lets us run multiple log_and_send calls and verify
    dedup behaves correctly as jobs arrive gradually over time.
    """

    def __init__(self):
        self.alerted: dict[str, list[str]] = {}  # source_job_id → [channels]
        self.rows: list = []  # moi AlertLog da add — de kiem tra status/error_message
        self._flush_count = 0

    async def execute(self, sql, params=None):
        # Tra ve TUPLE (job_source, source_job_id) va CHI cac dong thuoc kenh
        # dedup — dung nhu `_alerted_subquery` that. Ban cu tra ve id tran cho
        # moi kenh, tuc la mo phong mot hanh vi ma production khong con co.
        khoa = [
            (r.job_source, r.source_job_id)
            for r in self.rows
            if r.channel == DEDUP_CHANNEL
        ]
        class R:
            def all(self_inner):
                return khoa
        return R()

    def add(self, obj):
        self.rows.append(obj)
        channels = self.alerted.setdefault(obj.source_job_id, [])
        if obj.channel not in channels:
            channels.append(obj.channel)

    async def flush(self):
        self._flush_count += 1

    async def commit(self):
        # `log_and_send` COMMIT (khong phai flush) truoc moi lan goi mang, de
        # tra connection ve pool trong luc cho Telegram/Resend (JA-15). Fake
        # phai co ham nay, neu khong test do vi ly do khong lien quan gi toi
        # hanh vi dang kiem.
        self._commit_count = getattr(self, "_commit_count", 0) + 1


def _jobs(*ids_and_titles: tuple[str, str]) -> list[MatchedJob]:
    return [
        MatchedJob(source="vietnamworks", source_job_id=jid, title=title,
                   company_name="Co", city_canonical="HCMC", score=50.0)
        for jid, title in ids_and_titles
    ]


class TestMultiDayDispatch:
    """Simulate jobs arriving over multiple days and verify dedup is correct."""

    async def _dispatch(self, db: _SimDB, user, jobs, send_fn, chat_id=123):
        matcher = JobMatcher(db)
        return await matcher.log_and_send(user, jobs, chat_id=chat_id, send_fn=send_fn)

    # ── Day-by-day scenarios ──────────────────────────

    @pytest.mark.asyncio
    async def test_day1_all_new(self):
        """Day 1: 4 new jobs arrive → user gets alerted for all 4."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        jobs = _jobs(("j1", "AI Engineer"), ("j2", "Data Analyst"), ("j3", "ML Engineer"), ("j4", "Backend Dev"))
        sent = await self._dispatch(db, user, jobs, send_fn)

        assert sent == 4
        assert send_fn.call_count == 1
        assert len(db.alerted) == 4
        # Each job has website + telegram channels
        for channels in db.alerted.values():
            assert "website" in channels
            assert "telegram" in channels

    @pytest.mark.asyncio
    async def test_day2_partial_new(self):
        """Day 1: 3 jobs → all alerted. Day 2: same 3 + 2 new → only 2 alerted."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        # Day 1
        day1_jobs = _jobs(("j1", "AI Engineer"), ("j2", "Data Analyst"), ("j3", "Backend Dev"))
        sent1 = await self._dispatch(db, user, day1_jobs, send_fn)
        assert sent1 == 3

        # Day 2: same 3 jobs still active + 2 new ones
        day2_jobs = _jobs(
            ("j1", "AI Engineer"), ("j2", "Data Analyst"), ("j3", "Backend Dev"),
            ("j4", "ML Engineer"), ("j5", "DevOps"),
        )
        send_fn.reset_mock()
        sent2 = await self._dispatch(db, user, day2_jobs, send_fn)
        assert sent2 == 2
        send_fn.assert_called_once()

    @pytest.mark.asyncio
    async def test_day3_all_old(self):
        """Day 1: 3 jobs → alerted. Day 2: same 3 → 0 alerted (all duplicates)."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        day1_jobs = _jobs(("j1", "AI Engineer"), ("j2", "Data Analyst"), ("j3", "Backend Dev"))
        await self._dispatch(db, user, day1_jobs, send_fn)

        # Same jobs next day
        send_fn.reset_mock()
        sent2 = await self._dispatch(db, user, day1_jobs, send_fn)
        assert sent2 == 0
        send_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_five_day_simulation(self):
        """Full 5-day simulation with jobs arriving and expiring each day."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        # Day 1: 3 brand new jobs
        day1 = _jobs(("j1", "AI Eng"), ("j2", "Data Analyst"), ("j3", "Backend"))
        assert await self._dispatch(db, user, day1, send_fn) == 3

        # Day 2: j1, j2 still active + j4 new (j3 expired)
        day2 = _jobs(("j1", "AI Eng"), ("j2", "Data Analyst"), ("j4", "DevOps"))
        send_fn.reset_mock()
        assert await self._dispatch(db, user, day2, send_fn) == 1  # only j4

        # Day 3: j2, j4 still active + j5, j6 new
        day3 = _jobs(("j2", "Data Analyst"), ("j4", "DevOps"), ("j5", "ML Eng"), ("j6", "Frontend"))
        send_fn.reset_mock()
        assert await self._dispatch(db, user, day3, send_fn) == 2  # j5, j6

        # Day 4: all old jobs expired, 3 brand new ones
        day4 = _jobs(("j7", "Cloud Eng"), ("j8", "SRE"), ("j9", "Platform Eng"))
        send_fn.reset_mock()
        assert await self._dispatch(db, user, day4, send_fn) == 3

        # Day 5: mix of previously alerted (j1, j7) and new (j10)
        day5 = _jobs(("j1", "AI Eng"), ("j7", "Cloud Eng"), ("j10", "Security Eng"))
        send_fn.reset_mock()
        assert await self._dispatch(db, user, day5, send_fn) == 1  # only j10

        # Total unique jobs alerted across 5 days
        assert len(db.alerted) == 10

    @pytest.mark.asyncio
    async def test_telegram_fail_website_still_deduped(self):
        """Day 1: telegram fails → website logs persisted. Day 2: same jobs → 0 alerted."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock(side_effect=RuntimeError("telegram timeout"))

        day1_jobs = _jobs(("j1", "AI Engineer"), ("j2", "Backend Dev"))
        sent1 = await self._dispatch(db, user, day1_jobs, send_fn)
        assert sent1 == 2
        # Website logs exist even though telegram failed
        assert "j1" in db.alerted
        assert "j2" in db.alerted

        # Telegram that bai VAN phai de lai ban ghi status='failed'.
        # Hai dong nay truoc day khang dinh == ["website"] kem chu thich
        # "no telegram channel" — tuc la TEST DANG MA HOA CHINH CAI BUG: nhanh
        # except nuot loi nen that bai hoan toan vo hinh. Y dinh that cua test
        # (theo docstring) la "website van duoc ghi nen hom sau dedup dung", va
        # y dinh do van duoc giu nguyen o phan Day 2 ben duoi.
        assert db.alerted["j1"] == ["website", "telegram"]
        assert db.alerted["j2"] == ["website", "telegram"]

        telegram_rows = [r for r in db.rows if r.channel == "telegram"]
        assert len(telegram_rows) == 2
        assert all(r.status == "failed" for r in telegram_rows)
        assert all("telegram timeout" in (r.error_message or "") for r in telegram_rows)

        # Day 2: same jobs → deduped via website log
        send_fn_ok = AsyncMock()
        sent2 = await self._dispatch(db, user, day1_jobs, send_fn_ok)
        assert sent2 == 0
        send_fn_ok.assert_not_called()

    @pytest.mark.asyncio
    async def test_telegram_recovers_next_day(self):
        """Day 1: telegram fails for 2 jobs. Day 2: 1 old + 1 new → only new alerted."""
        db = _SimDB()
        user = _make_user()

        # Day 1: telegram fails
        fail_fn = AsyncMock(side_effect=RuntimeError("timeout"))
        day1_jobs = _jobs(("j1", "AI Engineer"), ("j2", "Data Analyst"))
        await self._dispatch(db, user, day1_jobs, fail_fn)

        # Day 2: telegram recovers, 1 old job (j1) + 1 new (j3)
        ok_fn = AsyncMock()
        day2_jobs = _jobs(("j1", "AI Engineer"), ("j3", "ML Engineer"))
        sent = await self._dispatch(db, user, day2_jobs, ok_fn)
        assert sent == 1  # only j3
        ok_fn.assert_called_once()

    @pytest.mark.asyncio
    async def test_khong_co_kenh_nao_thi_khong_ghi_gi(self):
        """User chua co kenh gui nao thi KHONG duoc dot hang doi alert (JA-52).

        Test nay truoc day ten la `test_no_chat_id_still_logs_website` va
        khang dinh dieu nguoc lai — no mo ta dung code luc do, va chinh no giu
        bug o nguyen tai cho.

        Ban cu ghi dong `website` vo dieu kien, ke ca cho nguoi chua noi
        Telegram va chua bat email. Moi slot (~8 lan/ngay) he thong danh dau
        hang loat job la "da alert" cho nguoi chua he duoc bao gi. Dang ky hom
        nay, mot tuan sau moi noi bot -> mat sach cac match tot nhat da tich
        luy, va khong co gi trong UI cho biet dieu do da xay ra.
        """
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        jobs = _jobs(("j1", "AI Engineer"), ("j2", "Backend Dev"))
        sent = await self._dispatch(db, user, jobs, send_fn, chat_id=None)

        assert sent == 0
        assert db.rows == [], "da ghi alert_logs cho user khong co kenh gui nao"
        send_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_chi_bat_email_van_duoc_ghi(self):
        """Co email la co kenh gui — phai ghi dau moc dedup binh thuong."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()
        matcher = JobMatcher(db)

        jobs = _jobs(("j1", "AI Engineer"))
        sent = await matcher.log_and_send(
            user, jobs, chat_id=None, send_fn=send_fn, email_enabled=True
        )

        assert sent == 1
        assert db.alerted["j1"] == [DEDUP_CHANNEL]
        send_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_empty_jobs_list(self):
        """No matching jobs → 0 sent, no crash."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()
        sent = await self._dispatch(db, user, [], send_fn)
        assert sent == 0
        send_fn.assert_not_called()

    @pytest.mark.asyncio
    async def test_different_sources_same_job_id(self):
        """Same source_job_id from different sources treated as different jobs."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        # Day 1: VNW job "123"
        day1 = [MatchedJob(source="vietnamworks", source_job_id="123", title="AI Engineer")]
        sent1 = await self._dispatch(db, user, day1, send_fn)
        assert sent1 == 1

        # Day 2: ITviec also has job "123" (different source, same ID)
        day2 = [MatchedJob(source="vietnamworks", source_job_id="123", title="AI Engineer"),
                MatchedJob(source="itviec", source_job_id="123", title="AI Engineer")]
        send_fn.reset_mock()
        sent2 = await self._dispatch(db, user, day2, send_fn)
        # Khoa thuc the cua warehouse la (source, source_job_id): job ITviec
        # "123" la mot tin HOAN TOAN KHAC job VietnamWorks "123". Ban cu dedup
        # theo id tran nen chan no vinh vien (JA-05) — va neu ca hai vao cung
        # mot batch thi UniqueViolation nem ra SAU KHI tin da gui di.
        assert sent2 == 1, "job cua nguon khac trung id bi chan nham"
        assert ("itviec", "123") in {(r.job_source, r.source_job_id) for r in db.rows}

    @pytest.mark.asyncio
    async def test_message_content_varies_per_day(self):
        """Verify message text reflects only NEW jobs each day, not all active jobs."""
        db = _SimDB()
        user = _make_user()
        send_fn = AsyncMock()

        day1 = _jobs(("j1", "AI Engineer"), ("j2", "Data Analyst"))
        await self._dispatch(db, user, day1, send_fn)
        msg1 = send_fn.call_args[0][1]
        assert "AI Engineer" in msg1
        assert "Data Analyst" in msg1

        day2 = _jobs(("j1", "AI Engineer"), ("j3", "DevOps Engineer"))
        send_fn.reset_mock()
        await self._dispatch(db, user, day2, send_fn)
        msg2 = send_fn.call_args[0][1]
        assert "AI Engineer" not in msg2  # already alerted
        assert "DevOps Engineer" in msg2
