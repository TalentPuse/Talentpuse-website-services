from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse",
    )
    DASHBOARD_API_URL: str = os.getenv("DASHBOARD_API_URL", "http://localhost:8001")
    DASHBOARD_API_SECRET: str = os.getenv("DASHBOARD_API_SECRET", "")
    DB_POOL_MIN: int = int(os.getenv("DB_POOL_MIN", "2"))
    DB_POOL_MAX: int = int(os.getenv("DB_POOL_MAX", "10"))
    HTTP_TIMEOUT: int = int(os.getenv("HTTP_TIMEOUT", "120"))
    JOBSPY_SITES: str = os.getenv("JOBSPY_SITES", "linkedin,indeed")
    JOBSPY_DEFAULT_RESULTS: int = int(os.getenv("JOBSPY_DEFAULT_RESULTS", "20"))
    JOBSPY_HOURS_OLD: int = int(os.getenv("JOBSPY_HOURS_OLD", "72"))
    JOBSPY_TIMEOUT: int = int(os.getenv("JOBSPY_TIMEOUT", "60"))


config = Config()
