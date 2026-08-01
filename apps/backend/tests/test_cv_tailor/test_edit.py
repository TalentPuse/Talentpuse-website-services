"""Tests for the concurrent first-insert race in apply_edit (edit.py).

apply_edit's row-is-None branch used to run the SAME first-insert pattern as
ensure_document (build.py) -- row is None -> db.add(row) -> await db.flush()
-- but with NO advisory lock and NO IntegrityError handling at all. A real
two-concurrent-first-insert race (e.g. user chats "sua CV giup toi" at the
exact moment the frontend's GET /api/cv/document is loading for the very
first time, so neither request has a CvDocument row yet) raised IntegrityError
straight out of apply_edit, uncaught by cv_edit_tool.py's
`except ValueError / except RuntimeError` around the call.

These tests exercise apply_edit() directly against fake AsyncSession doubles
(no real DB / LLM / Tectonic needed) to prove the race is now handled the
same way ensure_document handles it: same advisory-lock namespace, same
catch-IntegrityError-then-rollback-then-re-query recovery shape.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.cv_document import CvDocument
from app.services.cv_parser import MAX_CV_TEXT_CHARS
from app.services.cv_tailor.edit import apply_edit

# ─────────────────────────────────────────────
# Fakes (mirrors tests/test_cv_tailor/test_build.py)
# ─────────────────────────────────────────────

class _MissingGreenlet(Exception):
    """Stand-in for sqlalchemy.exc.MissingGreenlet: in the real AsyncSession,
    touching an attribute that needs a DB round-trip outside the greenlet
    context blows up exactly like this."""


class _ExpiringUser:
    """Mimics ORM attribute expiry after AsyncSession.rollback().

    Real rollback() expires every object still attached to the session --
    including `user`, passed into apply_edit by the caller (cv_edit_tool.py
    loads it through the same `db` session). Once `expired` flips, touching
    `.id` raises, so any regression that re-reads `user.id` after rollback
    (instead of the user_id captured before it) fails this test with the
    same shape of error production would see: MissingGreenlet.
    """

    def __init__(self, user_id, cv_text):
        self._id = user_id
        self.cv_text = cv_text
        self.expired = False

    @property
    def id(self):
        if self.expired:
            raise _MissingGreenlet("attribute refresh requires IO outside greenlet")
        return self._id


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _RaceDB:
    """Fake AsyncSession: the first-insert loser gets IntegrityError on
    flush(), then rollback() -- which expires `user` -- after which the
    winner's row becomes visible on re-query (simulating the winner's
    already-committed insert from a concurrent request)."""

    def __init__(self, expiring_user, winner_row):
        self._expiring_user = expiring_user
        self._winner_row = winner_row
        self.added: list = []
        self.flush_calls = 0
        self.commit_calls = 0
        self.rollback_calls = 0
        self.lock_calls = 0

    async def execute(self, stmt, params=None):
        sql = str(stmt)
        if "pg_advisory_xact_lock" in sql:
            self.lock_calls += 1
            return _FakeResult(True)
        # Before rollback: no row yet (we're about to build). After rollback:
        # the concurrent winner's insert is now visible.
        row = self._winner_row if self.rollback_calls else None
        return _FakeResult(row)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_calls += 1
        raise IntegrityError(
            "INSERT INTO cv_documents ...", {},
            Exception("duplicate key value violates unique constraint"),
        )

    async def rollback(self):
        self.rollback_calls += 1
        self._expiring_user.expired = True

    async def commit(self):
        self.commit_calls += 1


class _ReadOnlyDB:
    """Fake AsyncSession that always finds the given row (or None) -- the
    fast path where apply_edit should never touch the lock or the
    LLM-base-build pipeline at all."""

    def __init__(self, row):
        self._row = row
        self.lock_calls = 0
        self.commit_calls = 0

    async def execute(self, stmt, params=None):
        if "pg_advisory_xact_lock" in str(stmt):
            self.lock_calls += 1
        return _FakeResult(self._row)

    async def commit(self):
        self.commit_calls += 1


class _BuildOnceDB:
    """Fake AsyncSession for the plain (non-racing) first-build path: no row
    yet, lock acquires cleanly, build + insert flushes without conflict."""

    def __init__(self):
        self.added: list = []
        self.lock_calls = 0
        self.flush_calls = 0
        self.commit_calls = 0

    async def execute(self, stmt, params=None):
        if "pg_advisory_xact_lock" in str(stmt):
            self.lock_calls += 1
            return _FakeResult(True)
        return _FakeResult(None)

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        self.flush_calls += 1

    async def commit(self):
        self.commit_calls += 1


def _fake_model(full_name: str) -> MagicMock:
    model = MagicMock()
    model.model_dump.return_value = {"header": {"full_name": full_name}}
    return model


def _resume_model_json(full_name: str) -> dict:
    return {"header": {"full_name": full_name}}


# ─────────────────────────────────────────────
# Tests -- race / lock behavior (A)
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_apply_edit_survives_integrity_race_without_missing_greenlet():
    user_id = uuid4()
    winner_row = CvDocument(
        user_id=user_id,
        model_json=_resume_model_json("Bao"),
        pdf_url="http://minio/winner.pdf",
        page_count=1,
    )
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    db = _RaceDB(expiring_user=user, winner_row=winner_row)

    with patch("app.services.cv_tailor.edit.build_base_model_from_cv_text",
               AsyncMock(return_value=_fake_model("Bao (loser)"))), \
         patch("app.services.cv_tailor.edit._llm_edit",
               return_value=(_fake_model("Bao edited"), "Đã rút gọn summary.")), \
         patch("app.services.cv_tailor.edit.compile_and_store",
               AsyncMock(return_value=("http://minio/edited.pdf", 1))):
        result = await apply_edit(db, user, "rút gọn summary")

    # No exception raised (in particular no MissingGreenlet) even though the
    # user object was expired by rollback along the way.
    assert db.flush_calls == 1
    assert db.rollback_calls == 1
    assert user.expired is True  # proves the race path really was exercised
    assert db.commit_calls == 1
    # The edit was applied on top of the winner's row, not the loser's.
    assert result["change_summary"] == "Đã rút gọn summary."
    assert result["pdf_url"] == "http://minio/edited.pdf"
    assert result["model"]["header"]["full_name"] == "Bao edited"


@pytest.mark.asyncio
async def test_apply_edit_acquires_advisory_lock_before_building():
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    db = _BuildOnceDB()

    with patch("app.services.cv_tailor.edit.build_base_model_from_cv_text",
               AsyncMock(return_value=_fake_model("Bao"))), \
         patch("app.services.cv_tailor.edit._llm_edit",
               return_value=(_fake_model("Bao edited"), "Đã thêm Kubernetes.")), \
         patch("app.services.cv_tailor.edit.compile_and_store",
               AsyncMock(return_value=("http://minio/bao.pdf", 2))):
        result = await apply_edit(db, user, "thêm Kubernetes")

    assert db.lock_calls == 1
    assert db.flush_calls == 1
    assert db.commit_calls == 1
    assert result["pdf_url"] == "http://minio/bao.pdf"
    assert result["page_count"] == 2
    assert result["change_summary"] == "Đã thêm Kubernetes."


@pytest.mark.asyncio
async def test_apply_edit_fast_path_skips_lock_when_row_exists():
    """When the doc already exists, edit_cv must stay lock-free -- only the
    first-build step needs to serialize, not every edit."""
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    existing_row = CvDocument(
        user_id=user_id,
        model_json=_resume_model_json("Bao"),
        pdf_url="http://minio/bao.pdf",
        page_count=1,
    )
    db = _ReadOnlyDB(existing_row)

    with patch("app.services.cv_tailor.edit._llm_edit",
               return_value=(_fake_model("Bao edited"), "Đã sửa.")), \
         patch("app.services.cv_tailor.edit.compile_and_store",
               AsyncMock(return_value=("http://minio/bao-edited.pdf", 1))):
        result = await apply_edit(db, user, "sửa gì đó")

    assert db.lock_calls == 0
    assert result["pdf_url"] == "http://minio/bao-edited.pdf"


@pytest.mark.asyncio
async def test_apply_edit_reraises_when_winner_row_never_appears():
    """If the IntegrityError fires but a re-query still finds nothing (should
    not happen in practice, but must not hide the real error), the original
    IntegrityError propagates instead of being swallowed."""
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    db = _RaceDB(expiring_user=user, winner_row=None)

    with patch("app.services.cv_tailor.edit.build_base_model_from_cv_text",
               AsyncMock(return_value=_fake_model("Bao"))), \
         pytest.raises(IntegrityError):
        await apply_edit(db, user, "thêm Kubernetes")

    assert user.expired is True


@pytest.mark.asyncio
async def test_apply_edit_raises_value_error_when_no_cv_at_all():
    """No CvDocument row AND no cv_text -> ValueError('no_cv'), the case
    cv_edit_tool.py maps to the friendly 'upload a CV first' message."""
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text=None)
    db = _ReadOnlyDB(None)

    with pytest.raises(ValueError, match="no_cv"):
        await apply_edit(db, user, "thêm Kubernetes")

    assert db.lock_calls == 0


# ─────────────────────────────────────────────
# Tests -- cv_text truncation before hitting the LLM (B)
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_apply_edit_truncates_long_cv_text_before_building_base_model():
    """user.cv_text is read straight from the DB with no length guarantee
    (MAX_CV_TEXT_CHARS was previously only enforced on the upload path). The
    first-build branch must truncate at the read point before forwarding to
    the LLM."""
    long_text = "a" * (MAX_CV_TEXT_CHARS + 5000)
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text=long_text)
    db = _BuildOnceDB()

    captured: dict = {}

    async def _capture_build(cv_text):
        captured["cv_text"] = cv_text
        return _fake_model("Bao")

    with patch("app.services.cv_tailor.edit.build_base_model_from_cv_text", _capture_build), \
         patch("app.services.cv_tailor.edit._llm_edit",
               return_value=(_fake_model("Bao edited"), "Đã sửa.")), \
         patch("app.services.cv_tailor.edit.compile_and_store",
               AsyncMock(return_value=("http://minio/bao.pdf", 1))):
        await apply_edit(db, user, "sửa gì đó")

    assert len(captured["cv_text"]) <= MAX_CV_TEXT_CHARS
