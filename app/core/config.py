from __future__ import annotations

import os

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
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "TalentPulseBot")
TELEGRAM_WEBHOOK_SECRET = os.getenv("TELEGRAM_WEBHOOK_SECRET", "dev-webhook-secret")

ALERT_INTERVAL_SECONDS = int(os.getenv("ALERT_INTERVAL_SECONDS", "7200"))
