"""JA-01 — advisory lock cua dispatch khong duoc ro ri sang connection pool.

Loi goc: `dispatch_alerts` lay `pg_try_advisory_lock` TREN `AsyncSession` roi
`await db.commit()` sau MOI user. Advisory lock la session-level (gan vao
backend connection), con commit thi KET THUC transaction va tra DBAPI
connection ve pool. Tu do tro di moi lenh check-out mot connection khac:

  - `pg_advisory_unlock` o `finally` chay tren connection KHAC -> Postgres tra
    `false` va log "you don't own a lock of type ExclusiveLock". Lock nam lai
    tren connection cu VO THOI HAN (engine khong co `pool_recycle`).
  - Moi dispatch sau do -> `pg_try_advisory_lock` tra `false` -> "already in
    progress" -> tra 0. Alert NGUNG HAN cho toi khi container restart, khong
    exception, khong metric.
  - Nguoc lai, neu lan sau tinh co nhan dung connection dang giu lock thi
    advisory lock RE-ENTRANT theo connection: dispatch thu hai tai chiem lock
    va chay SONG SONG -> gui trung Telegram + email cho cung mot user.

Nen cach kiem o day khong phai "goi dispatch hai lan xem co bi chan khong" —
voi pool 5 connection thi ket qua do ngau nhien. Kiem TRUC TIEP tren
`pg_locks`, la thu duy nhat noi that ai dang giu cai gi.
"""
from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core import database as db_module
from app.core.dispatch_lock import ALERT_DISPATCH_LOCK_ID, alert_dispatch_lock

pytestmark = pytest.mark.asyncio


async def _dem_lock() -> int:
    """Dem so advisory lock dang giu tren khoa dispatch, tu MOT connection khac.

    `pg_locks` la view toan cluster nen connection nao doc cung thay. Ban
    single-arg cua `pg_try_advisory_lock` tach key 64-bit thanh
    (classid = key >> 32, objid = key & 0xFFFFFFFF).
    """
    async with db_module.engine.connect() as conn:
        row = await conn.execute(
            text(
                "SELECT count(*) FROM pg_locks "
                "WHERE locktype = 'advisory' "
                "AND ((classid::bigint << 32) | objid::bigint) = :key"
            ),
            {"key": ALERT_DISPATCH_LOCK_ID},
        )
        return row.scalar_one()


async def test_lock_song_sot_qua_commit_cua_session():
    """Lock phai con nguyen sau khi vong dispatch commit.

    Day la ban tai hien truc tiep cua JA-01: khong phai "co commit thi lock
    mat" ma "commit lam connection giu lock roi khoi tay ta". Neu lock nam
    tren chinh session bi commit, khang dinh cuoi cung (giai phong sach) se
    that bai vi unlock chay nham connection.
    """
    async with alert_dispatch_lock() as lay_duoc:
        assert lay_duoc is True

        # Dung dieu ma dispatch_alerts lam sau moi user: mot session rieng,
        # ghi gi do, commit. Duoi co che cu, chinh dong nay day connection
        # dang giu lock ve pool.
        async with db_module.async_session_factory() as db:
            await db.execute(text("SELECT 1"))
            await db.commit()

        assert await _dem_lock() == 1, "lock bien mat giua chung -> mat loai tru"

    assert await _dem_lock() == 0, "lock khong duoc giai phong -> dispatch ket vinh vien"


async def test_lock_thu_hai_bi_tu_choi_khi_lock_dang_giu():
    """Loai tru that: khong duoc de hai dispatch chay song song.

    Kiem ca tinh RE-ENTRANT: advisory lock cung mot connection co the lay lai
    nhieu lan ma van thanh cong. Vi acquirer thu hai mo connection RIENG nen
    no phai bi tu choi — do la dieu bao ve viec gui trung.
    """
    async with alert_dispatch_lock() as thu_nhat:
        assert thu_nhat is True

        async with alert_dispatch_lock() as thu_hai:
            assert thu_hai is False, "dispatch thu hai chen vao duoc -> gui trung alert"

        # Acquirer bi tu choi khong duoc unlock nham cua nguoi khac.
        assert await _dem_lock() == 1

    assert await _dem_lock() == 0


async def test_lock_duoc_tra_lai_khi_co_exception():
    """Dispatch no giua chung khong duoc de lai lock treo.

    Khong bat exception o day — no phai truyen ra ngoai nguyen ven de
    `_alert_loop` con ghi log duoc; context manager chi co trach nhiem don
    dep.
    """
    class LoiGia(RuntimeError):
        pass

    with pytest.raises(LoiGia):
        async with alert_dispatch_lock() as lay_duoc:
            assert lay_duoc is True
            raise LoiGia("dispatch chet giua chung")

    assert await _dem_lock() == 0


async def test_khong_unlock_khi_khong_lay_duoc_lock():
    """Nguoi khong giu lock tuyet doi khong duoc goi unlock.

    Neu context manager unlock vo dieu kien o `finally`, mot dispatch bi tu
    choi se GO LOCK cua dispatch dang chay — bien loi "bi bo qua" thanh loi
    "chay song song", te hon han.
    """
    async with alert_dispatch_lock() as giu:
        assert giu is True

        async with alert_dispatch_lock() as bi_tu_choi:
            assert bi_tu_choi is False

        assert await _dem_lock() == 1, "acquirer bi tu choi da go lock cua nguoi dang giu"

    assert await _dem_lock() == 0


async def test_dispatch_alerts_khong_de_lai_lock(monkeypatch):
    """Kiem o muc dich thuc: sau `dispatch_alerts`, khong con lock nao treo.

    `find_jobs` bi thay bang ham tra rong CO CHU DICH. Chay that tren DB dev
    nghia la gui Telegram + email that toi user that trong bang `app.users` —
    mot test khong duoc phep lam vay. Vong lap user, viec lay/nha khoa va
    duong return van la code that; chi phan I/O ra ngoai bi cat.
    """
    from app.services import job_alert
    from app.services.job_matcher import JobMatcher

    async def khong_co_job(self, user, include_alerted=False):
        return []

    monkeypatch.setattr(JobMatcher, "find_jobs", khong_co_job)

    async with db_module.async_session_factory() as db:
        assert await job_alert.dispatch_alerts(db, source="test") == 0

    assert await _dem_lock() == 0
