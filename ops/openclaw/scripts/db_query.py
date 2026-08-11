"""Wrapper chay SQL chi-doc len warehouse TalentPulse.

Chi chap nhan SELECT (hoac WITH ... SELECT). Moi thu khac — DDL, DML, da cau
lenh, comment — bi chan o day, KHONG phu thuoc vao agent co ngoan hay khong.

Cach dung (tren box, co ~/.pgpass hoac bien moi):
    python db_query.py --sql "SELECT count(*) FROM app.users"
    python db_query.py --sql "$(cat query.sql)"
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

# Keywords ghi — xuat hien o bat ky dau trong cau lenh thi chan.
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"copy|vacuum|reindex|cluster|comment|merge|call|do)\b",
    re.IGNORECASE,
)


def validate_sql(sql: str) -> bool:
    """Tra True neu cau lenh an toan doc-only: 1 cau, bat dau SELECT/WITH."""
    stripped = sql.strip()
    if not stripped:
        return False
    if ";" in stripped or "--" in stripped or "/*" in stripped:
        return False
    if not re.match(r"^(select|with)\b", stripped, re.IGNORECASE):
        return False
    if _FORBIDDEN.search(stripped):
        return False
    return True


def run_query(sql: str, db_url: str | None) -> int:
    if not validate_sql(sql):
        print("CHAN: chi cho phep SELECT doc-only (mot cau lenh, khong comment).", file=sys.stderr)
        return 2
    psql = ["psql", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql]
    if db_url:
        psql.insert(1, db_url)
    return subprocess.run(psql).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Query doc-only warehouse")
    parser.add_argument("--sql", required=True, help="Cau lenh SELECT duy nhat")
    parser.add_argument("--db-url", default=os.getenv("TP_DB_URL", ""), help="Connection string (mac dinh TP_DB_URL)")
    args = parser.parse_args()
    return run_query(args.sql, args.db_url or None)


if __name__ == "__main__":
    sys.exit(main())
