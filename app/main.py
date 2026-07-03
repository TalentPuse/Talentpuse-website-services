from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, auth, chat, companies, cv, email, interview, jobs, overview, recommendations, salary, skills, telegram
from app.services.interview_agent.api import interview_router as interview_agent_router
from app.core.config import (
    ALERT_END_TIME,
    ALERT_START_TIME,
    CORS_ORIGINS,
    VN_TZ,
    get_alert_interval_hours,
)
from app.core import database as db_module
from app.services.job_alert import dispatch_alerts

logger = logging.getLogger(__name__)

alert_loop_active = True


def _next_alert_slot() -> datetime:
    now_vn = datetime.now(VN_TZ)
    today = now_vn.date()

    interval_hours = get_alert_interval_hours()

    slots: list[datetime] = []
    t = datetime.combine(today, ALERT_START_TIME, tzinfo=VN_TZ)
    while t.time() <= ALERT_END_TIME:
        slots.append(t)
        t += timedelta(hours=interval_hours)

    for slot in slots:
        if slot > now_vn + timedelta(seconds=60):
            return slot

    tomorrow = today + timedelta(days=1)
    return datetime.combine(tomorrow, ALERT_START_TIME, tzinfo=VN_TZ)


async def _alert_loop() -> None:
    await asyncio.sleep(30)
    while True:
        next_slot = _next_alert_slot()
        wait_seconds = (next_slot - datetime.now(VN_TZ)).total_seconds()
        logger.info("Next alert slot: %s (in %.0fs)", next_slot.strftime("%H:%M %d/%m"), wait_seconds)
        await asyncio.sleep(max(wait_seconds, 10))

        try:
            if alert_loop_active and db_module.async_session_factory is not None:
                async with db_module.async_session_factory() as db:
                    count = await dispatch_alerts(db, source="background_loop")
                    logger.info("Alert dispatch completed: %d alerts sent", count)
        except Exception:
            logger.exception("Alert dispatch failed")
        else:
            if not alert_loop_active:
                logger.debug("Alert loop paused (alert_loop_active=False)")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await db_module.init_db()
    task = asyncio.create_task(_alert_loop())
    yield
    task.cancel()
    await db_module.close_db()


app = FastAPI(
    title="TalentPuse Dashboard API",
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
app.include_router(jobs.router)
app.include_router(telegram.router)
app.include_router(email.router)
app.include_router(admin.router)
app.include_router(chat.router)
app.include_router(cv.router)
app.include_router(recommendations.router)
app.include_router(interview.router)  # OLD interview API (Q&A based)
app.include_router(interview_agent_router)  # NEW chatbot-based interview (prefix already in router)


@app.get("/", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "talentpulse-dashboard-api"}
