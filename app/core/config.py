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

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:8002,http://frontend:8002").split(",")
]

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "TalentPuseBot")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "dev-webhook-secret")

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
