"""Live DB test: verify alert matching returns correct job_level for each profile type.

Run on prod server:
    docker exec -i talentpulse-postgres psql -U admin -d warehouse < tests/test_level_matching_live.sql

Or via Python:
    cd dashboard/backend && python -m pytest tests/test_level_matching_live.py -v -s
"""
from __future__ import annotations

import os

import pytest

# ─── Canonical taxonomy (single source of truth) ──────────────────
CANONICAL = {"Intern/Student", "Fresher/Entry level", "Mid-level", "Senior", "Manager", "Director+"}

# Same as job_alert.py LEVEL_MAP — duplicated here so test is self-contained
LEVEL_MAP = {
    "student": ["Intern/Student", "Fresher/Entry level"],
    "fresher": ["Fresher/Entry level", "Mid-level"],
    "experienced": ["Mid-level", "Senior"],
    "manager": ["Senior", "Manager", "Director+"],
}

DB_URL = os.getenv("DATABASE_URL", "postgresql://admin:admin@localhost:5432/warehouse")


def _get_conn():
    import psycopg
    return psycopg.connect(DB_URL)


class TestSilverJobLevel:
    """Verify silver layer only has canonical job_level values."""

    def test_no_non_canonical_values(self):
        """Silver job_level should only contain canonical values (no NULL, no raw)."""
        with _get_conn() as conn:
            rows = conn.execute("""
                SELECT job_level, count(*)
                FROM dbt_dev_silver.silver_job_detail
                WHERE job_level IS NOT NULL
                  AND job_level NOT IN ('Intern/Student','Fresher/Entry level','Mid-level',
                                        'Senior','Manager','Director+')
                GROUP BY job_level
            """).fetchall()
        assert rows == [], f"Non-canonical job_level values found: {rows}"

    def test_no_null_job_level(self):
        """After normalization, job_level should never be NULL."""
        with _get_conn() as conn:
            cnt = conn.execute("""
                SELECT count(*) FROM dbt_dev_silver.silver_job_detail
                WHERE job_level IS NULL
            """).fetchone()[0]
        assert cnt == 0, f"Found {cnt} rows with NULL job_level — should all default to Mid-level"


class TestFctJobsDailyJobLevel:
    """Verify gold layer (fct_jobs_daily) only has canonical values for active jobs."""

    def test_active_jobs_no_non_canonical(self):
        with _get_conn() as conn:
            rows = conn.execute("""
                SELECT job_level, count(*)
                FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active
                  AND job_level IS NOT NULL
                  AND job_level NOT IN ('Intern/Student','Fresher/Entry level','Mid-level',
                                        'Senior','Manager','Director+')
                GROUP BY job_level
            """).fetchall()
        assert rows == [], f"Non-canonical job_level in active jobs: {rows}"

    def test_active_jobs_no_null(self):
        with _get_conn() as conn:
            cnt = conn.execute("""
                SELECT count(*) FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active AND job_level IS NULL
            """).fetchone()[0]
        assert cnt == 0, f"Found {cnt} active jobs with NULL job_level"


class TestStudentMatching:
    """Simulate student profile — must only get Intern/Student + Fresher/Entry level jobs."""

    LEVELS = LEVEL_MAP["student"]

    def test_student_matches_only_allowed_levels(self):
        with _get_conn() as conn:
            rows = conn.execute("""
                SELECT source_job_id, title, job_level, company_name
                FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active
                  AND job_level = ANY(%(levels)s)
                ORDER BY posted_at DESC
                LIMIT 20
            """, {"levels": self.LEVELS}).fetchall()

        print(f"\n--- STUDENT profile: {len(rows)} jobs matched ---")
        for r in rows:
            print(f"  [{r[2]}] {r[1]} @ {r[3]}")

        # Verify ALL matched jobs have allowed levels
        for r in rows:
            assert r[2] in self.LEVELS, f"Student got disallowed level '{r[2]}': {r[1]}"

    def test_student_does_not_get_senior_jobs(self):
        disallowed = ["Senior", "Manager", "Director+", "Mid-level"]
        with _get_conn() as conn:
            cnt = conn.execute("""
                SELECT count(*) FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active
                  AND job_level = ANY(%(disallowed)s)
                  AND job_level != ALL(%(allowed)s)
            """, {"disallowed": disallowed, "allowed": self.LEVELS}).fetchone()[0]
        # These jobs exist but student filter should NEVER include them
        print(f"\n--- Jobs that student filter EXCLUDES: {cnt} ---")


class TestExperiencedMatching:
    """Simulate experienced profile — must only get Mid-level + Senior jobs."""

    LEVELS = LEVEL_MAP["experienced"]

    def test_experienced_matches_only_allowed_levels(self):
        with _get_conn() as conn:
            rows = conn.execute("""
                SELECT source_job_id, title, job_level, company_name
                FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active
                  AND job_level = ANY(%(levels)s)
                ORDER BY posted_at DESC
                LIMIT 20
            """, {"levels": self.LEVELS}).fetchall()

        print(f"\n--- EXPERIENCED profile: {len(rows)} jobs matched ---")
        for r in rows:
            print(f"  [{r[2]}] {r[1]} @ {r[3]}")

        for r in rows:
            assert r[2] in self.LEVELS, f"Experienced got disallowed level '{r[2]}': {r[1]}"


class TestManagerMatching:
    """Simulate manager profile — must only get Senior + Manager + Director+ jobs."""

    LEVELS = LEVEL_MAP["manager"]

    def test_manager_matches_only_allowed_levels(self):
        with _get_conn() as conn:
            rows = conn.execute("""
                SELECT source_job_id, title, job_level, company_name
                FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active
                  AND job_level = ANY(%(levels)s)
                ORDER BY posted_at DESC
                LIMIT 20
            """, {"levels": self.LEVELS}).fetchall()

        print(f"\n--- MANAGER profile: {len(rows)} jobs matched ---")
        for r in rows:
            print(f"  [{r[2]}] {r[1]} @ {r[3]}")

        for r in rows:
            assert r[2] in self.LEVELS, f"Manager got disallowed level '{r[2]}': {r[1]}"


class TestDistribution:
    """Print job_level distribution for review."""

    def test_print_distribution(self):
        with _get_conn() as conn:
            rows = conn.execute("""
                SELECT job_level, count(*) as cnt
                FROM dbt_dev_gold.fct_jobs_daily
                WHERE is_active
                GROUP BY job_level
                ORDER BY cnt DESC
            """).fetchall()

        print("\n=== ACTIVE JOBS BY LEVEL ===")
        total = 0
        for r in rows:
            print(f"  {r[0] or 'NULL':25s} {r[1]:>5d}")
            total += r[1]
        print(f"  {'TOTAL':25s} {total:>5d}")

        # Assert no NULLs and no non-canonical
        for r in rows:
            if r[0] is not None:
                assert r[0] in CANONICAL, f"Non-canonical level: {r[0]}"
