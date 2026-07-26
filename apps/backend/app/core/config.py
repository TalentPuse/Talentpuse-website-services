from __future__ import annotations

import os
from datetime import time, timedelta, timezone

DATABASE_URL_RAW = os.getenv(
    "DATABASE_URL",
    "postgresql://metabase_ro:metabase_ro@localhost:5432/warehouse",
)

if DATABASE_URL_RAW.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL_RAW.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = DATABASE_URL_RAW

_WEAK_SECRETS = frozenset({
    "",
    "dev-secret-change-in-prod",
    "dev-webhook-secret",
    "TELEGRAM_WEBHOOK_SECRET",
    "changeme",
    "CHANGE_ME",
    "secret",
})


def _require_secret(name: str, *, min_length: int = 32) -> str:
    """Read a secret that must never fall back to a default.

    `os.getenv(name, "some-default")` is how production ends up signing tokens
    with a value that is committed to the repo: nothing fails, nothing warns, and
    anyone who has read the source can mint an admin token. Refusing to boot is
    the only behaviour that cannot be ignored.
    """
    value = os.getenv(name, "")
    if value in _WEAK_SECRETS or len(value) < min_length:
        raise RuntimeError(
            f"{name} is unset, shorter than {min_length} chars, or a known "
            f"placeholder. Generate one with:\n"
            f'    python -c "import secrets; print(secrets.token_urlsafe(48))"\n'
            f"then set it in the environment. Note that rotating it invalidates "
            f"every existing session."
        )
    return value


JWT_SECRET = _require_secret("JWT_SECRET")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:8002,http://frontend:8002").split(",")
]

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "TalentPuseBot")
# Guards the public Telegram webhook: a caller who knows it can inject bot
# updates, so it gets the same treatment as the JWT key.
TELEGRAM_WEBHOOK_SECRET = _require_secret("TELEGRAM_WEBHOOK_SECRET", min_length=24)

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM_EMAIL = os.getenv("RESEND_FROM_EMAIL", "TalentPulse <alerts@talentpuse.io.vn>")

ALERT_INTERVAL_SECONDS = int(os.getenv("ALERT_INTERVAL_SECONDS", "7200"))


def get_alert_interval_hours() -> float:
    return max(ALERT_INTERVAL_SECONDS / 3600.0, 0.5)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "deepseek/deepseek-v4-flash")

S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "http://minio:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "talentpulse-raw")

MCP_SERVER_URL = os.getenv("MCP_SERVER_URL", "http://localhost:8080")

# AI-native home (Phase 0): mount AG-UI agent endpoint khi bật.
AGUI_ENABLED = os.getenv("AGUI_ENABLED", "0") == "1"

VN_TZ = timezone(timedelta(hours=7))
ALERT_START_TIME = time(7, 30)
ALERT_END_TIME = time(21, 30)

# Cache tuy chon. Co default (khac DATABASE_URL): Redis chet thi app van chay,
# xem app/core/cache.py.
REDIS_URL = os.getenv("REDIS_URL", "redis://tp-redis:6379/0")

# Ket noi RIENG toi kho phan tich dbt (dbt_dev_bronze/silver/gold).
#
# MAC DINH BANG DATABASE_URL — day la diem mau chot de viec tach DB khong phai
# mot cu big-bang: hien app va kho van chung mot database, nen chua dat bien nay
# thi moi thu chay y nhu cu. Khi da tach, dat WAREHOUSE_DATABASE_URL tro vao kho
# roi chuyen dan tung module doc kho sang `get_warehouse_db()`. Chuyen toi dau
# chay tot toi do, moi buoc deploy doc lap duoc.
_WAREHOUSE_RAW = os.getenv("WAREHOUSE_DATABASE_URL") or DATABASE_URL_RAW
if _WAREHOUSE_RAW.startswith("postgresql://"):
    WAREHOUSE_DATABASE_URL = _WAREHOUSE_RAW.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    WAREHOUSE_DATABASE_URL = _WAREHOUSE_RAW
