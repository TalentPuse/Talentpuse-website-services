from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, companies, overview, salary, skills, telegram
from app.core.config import ALERT_INTERVAL_SECONDS, CORS_ORIGINS
from app.core.database import async_session_factory, close_db, init_db
from app.services.job_alert import dispatch_alerts

logger = logging.getLogger(__name__)

alert_loop_active = True


async def _alert_loop() -> None:
    await asyncio.sleep(30)
    while True:
        try:
            if alert_loop_active and async_session_factory is not None:
                async with async_session_factory() as db:
                    count = await dispatch_alerts(db)
                    if count:
                        logger.info("Alert dispatch: %d sent", count)
        except Exception:
            logger.exception("Alert dispatch failed")
        await asyncio.sleep(ALERT_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(_alert_loop())
    yield
    task.cancel()
    await close_db()


app = FastAPI(
    title="TalentPulse Dashboard API",
    description="Job market insights + AI alert auth for Vietnam IT/AI.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(skills.router)
app.include_router(salary.router)
app.include_router(companies.router)
app.include_router(auth.router)
app.include_router(telegram.router)
app.include_router(admin.router)


@app.get("/", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "talentpulse-dashboard-api"}
