"""Tests for the concurrent-build race in ensure_document (build.py).

Two GET /api/cv/document requests racing to build the same user's first CV
document used to 502 in two ways:
  1. No lock around the build step -> both requests build + insert -> the
     loser hits a unique-constraint IntegrityError.
  2. The IntegrityError handler called db.rollback(), which expires every ORM
     object tied to the session -- including `user` (loaded through the same
     session in get_current_user) -- and then touched the now-expired
     `user.id` again, raising MissingGreenlet (HTTP 500 plain text, unparsable
     by the frontend).

These tests exercise ensure_document() directly against fake AsyncSession
doubles (no real DB / LLM / Tectonic needed) to prove both are fixed.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.cv_document import CvDocument
from app.services.cv_tailor.build import ensure_document


# ─────────────────────────────────────────────
# Fakes
# ─────────────────────────────────────────────

class _MissingGreenlet(Exception):
    """Stand-in for sqlalchemy.exc.MissingGreenlet: in the real AsyncSession,
    touching an attribute that needs a DB round-trip outside the greenlet
    context blows up exactly like this."""


class _ExpiringUser:
    """Mimics ORM attribute expiry after AsyncSession.rollback().

    Real rollback() expires every object still attached to the session --
    including `user`, loaded earlier through the same `db` dependency in
    get_current_user. Once `expired` flips, touching `.id` raises, so any
    regression that re-reads `user.id` after rollback fails this test with
    the same shape of error production saw (MissingGreenlet), instead of
    silently passing.
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

    def scalar(self):
        return self._row


class _RaceDB:
    """Fake AsyncSession: the build-race loser gets IntegrityError on commit,
    then rollback() -- which expires `user` -- after which the winner's row
    becomes visible on re-query (simulating the winner's already-committed
    insert)."""

    def __init__(self, expiring_user, winner_row):
        self._expiring_user = expiring_user
        self._winner_row = winner_row
        self.added: list = []
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

    async def commit(self):
        self.commit_calls += 1
        raise IntegrityError(
            "INSERT INTO cv_documents ...", {},
            Exception("duplicate key value violates unique constraint"),
        )

    async def rollback(self):
        self.rollback_calls += 1
        self._expiring_user.expired = True


class _ReadOnlyDB:
    """Fake AsyncSession that always finds an existing row -- the fast path
    where ensure_document should never touch the lock or the LLM/compile
    pipeline at all."""

    def __init__(self, row):
        self._row = row
        self.lock_calls = 0

    async def execute(self, stmt, params=None):
        if "pg_advisory_xact_lock" in str(stmt):
            self.lock_calls += 1
        return _FakeResult(self._row)


class _BuildOnceDB:
    """Fake AsyncSession for the plain (non-racing) build path: no row yet,
    lock acquires cleanly, build + insert commits without conflict."""

    def __init__(self):
        self.added: list = []
        self.lock_calls = 0
        self.commit_calls = 0

    async def execute(self, stmt, params=None):
        if "pg_advisory_xact_lock" in str(stmt):
            self.lock_calls += 1
            return _FakeResult(True)
        return _FakeResult(None)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commit_calls += 1


def _fake_model(full_name: str) -> MagicMock:
    model = MagicMock()
    model.model_dump.return_value = {"header": {"full_name": full_name}}
    return model


# ─────────────────────────────────────────────
# Tests
# ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ensure_document_survives_integrity_race_without_missing_greenlet():
    user_id = uuid4()
    winner_row = CvDocument(
        user_id=user_id,
        model_json={"header": {"full_name": "Bao"}},
        pdf_url="http://minio/winner.pdf",
        page_count=1,
    )
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    db = _RaceDB(expiring_user=user, winner_row=winner_row)

    with patch("app.services.cv_tailor.build.build_base_model_from_cv_text",
               AsyncMock(return_value=_fake_model("Bao (loser)"))), \
         patch("app.services.cv_tailor.build.compile_and_store",
               AsyncMock(return_value=("http://minio/loser.pdf", 1))):
        result = await ensure_document(db, user)

    # No exception raised (in particular no MissingGreenlet) and a valid,
    # JSON-serializable dict comes back.
    assert db.commit_calls == 1
    assert db.rollback_calls == 1
    assert user.expired is True  # proves the race path really was exercised
    # Result reflects the winner's already-committed row, not the loser's.
    assert result["pdf_url"] == "http://minio/winner.pdf"
    assert result["model"]["header"]["full_name"] == "Bao"
    assert result["page_count"] == 1


@pytest.mark.asyncio
async def test_ensure_document_acquires_advisory_lock_before_building():
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    db = _BuildOnceDB()

    with patch("app.services.cv_tailor.build.build_base_model_from_cv_text",
               AsyncMock(return_value=_fake_model("Bao"))), \
         patch("app.services.cv_tailor.build.compile_and_store",
               AsyncMock(return_value=("http://minio/bao.pdf", 2))):
        result = await ensure_document(db, user)

    assert db.lock_calls == 1
    assert db.commit_calls == 1
    assert result["pdf_url"] == "http://minio/bao.pdf"
    assert result["page_count"] == 2


@pytest.mark.asyncio
async def test_ensure_document_fast_path_skips_lock_when_row_exists():
    """When the doc already exists, concurrent GETs must stay lock-free reads
    -- only the build step needs to serialize, not every read."""
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    existing_row = CvDocument(
        user_id=user_id,
        model_json={"header": {"full_name": "Bao"}},
        pdf_url="http://minio/bao.pdf",
        page_count=1,
    )
    db = _ReadOnlyDB(existing_row)

    result = await ensure_document(db, user)

    assert db.lock_calls == 0
    assert result["pdf_url"] == "http://minio/bao.pdf"


@pytest.mark.asyncio
async def test_ensure_document_truncates_long_cv_text_before_building_base_model():
    """user.cv_text is read straight from the DB with no length guarantee
    (MAX_CV_TEXT_CHARS was previously only enforced on the upload path, in
    cv_parser.extract_text). ensure_document's build branch must truncate at
    the read point before forwarding to the LLM."""
    from app.services.cv_parser import MAX_CV_TEXT_CHARS

    long_text = "a" * (MAX_CV_TEXT_CHARS + 5000)
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text=long_text)
    db = _BuildOnceDB()

    captured: dict = {}

    async def _capture_build(cv_text):
        captured["cv_text"] = cv_text
        return _fake_model("Bao")

    with patch("app.services.cv_tailor.build.build_base_model_from_cv_text", _capture_build), \
         patch("app.services.cv_tailor.build.compile_and_store",
               AsyncMock(return_value=("http://minio/bao.pdf", 1))):
        await ensure_document(db, user)

    assert len(captured["cv_text"]) <= MAX_CV_TEXT_CHARS


@pytest.mark.asyncio
async def test_ensure_document_reraises_when_winner_row_never_appears():
    """If the IntegrityError fires but a re-query still finds nothing (should
    not happen in practice, but must not hide the real error), the original
    IntegrityError propagates instead of being swallowed."""
    user_id = uuid4()
    user = _ExpiringUser(user_id=user_id, cv_text="Bao - Python dev")
    db = _RaceDB(expiring_user=user, winner_row=None)

    with patch("app.services.cv_tailor.build.build_base_model_from_cv_text",
               AsyncMock(return_value=_fake_model("Bao"))), \
         patch("app.services.cv_tailor.build.compile_and_store",
               AsyncMock(return_value=("http://minio/bao.pdf", 1))):
        with pytest.raises(IntegrityError):
            await ensure_document(db, user)

    assert user.expired is True
