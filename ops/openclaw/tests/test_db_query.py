"""Test validate_sql cua wrapper doc-only."""
from ops.openclaw.scripts.db_query import validate_sql


def test_chap_nhan_select_don_gian():
    assert validate_sql("SELECT count(*) FROM app.users")


def test_chap_nhan_with_cte():
    assert validate_sql("WITH x AS (SELECT 1) SELECT * FROM x")


def test_chan_update_insert_delete():
    for sql in ("UPDATE users SET x=1", "INSERT INTO t VALUES (1)", "DELETE FROM t"):
        assert not validate_sql(sql), sql


def test_chan_ddl():
    for sql in ("DROP TABLE t", "ALTER TABLE t ADD c int", "TRUNCATE t", "CREATE TABLE t()"):
        assert not validate_sql(sql), sql


def test_chan_da_cau_lenh():
    assert not validate_sql("SELECT 1; DROP TABLE t")


def test_chan_comment_smuggle():
    assert not validate_sql("SELECT 1 -- DROP TABLE t")
    assert not validate_sql("SELECT 1 /* x */")


def test_chan_rong():
    assert not validate_sql("   ")
    assert not validate_sql("")
