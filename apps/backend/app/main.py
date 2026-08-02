from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import admin, analytics, applications, auth, chat, companies, cv, email, interview, jobs, overview, recommendations, salary, skills, telegram
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

# Python KHONG gan handler nao cho root logger theo mac dinh, va uvicorn chi cau
# hinh rieng cac logger "uvicorn.*" — no khong dung toi root. Hau qua: moi
# logger.info() cua ung dung roi vao "lastResort" handler, von chi in tu WARNING
# tro len.
#
# Nghia la "Sent %d alerts to user %s" (job_alert.py) va "Alert dispatch
# completed" (ben duoi) CHUA BAO GIO xuat hien trong log, trong khi
# logger.warning("Alert dispatch already in progress") thi co. Nhin log chi thay
# duoc luc alert BI BO QUA, khong bao gio thay luc no CHAY THANH CONG — du kiem
# chung tren DB cho thay vong lap van dispatch dung khung gio.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)

logger = logging.getLogger(__name__)

alert_loop_active = True


def _next_alert_slot() -> datetime:
    now_vn = datetime.now(VN_TZ)
    today = now_vn.date()

    interval_hours = get_alert_interval_hours()

    # So bang MOC THOI GIAN TUYET DOI, khong phai gio-trong-ngay.
    #
    # Dieu kien cu `while t.time() <= ALERT_END_TIME` chi so GIO: moi interval
    # ma boi so cua no roi lai vao khung 07:30-21:30 cua NGAY SAU deu khong bao
    # gio thoat. Do duoc: 6h/12h/24h chay toi khi datetime tran nam 9999 roi
    # chet bang `OverflowError: date value out of range`.
    #
    # Vong lap nay DONG BO, khong co `await` nao ben trong, va chay tren event
    # loop chinh. Nen no vua chen ca process nhieu giay (toan bo API dung, ke ca
    # health check), vua phinh `slots` len hang trieu phan tu, roi ket thuc bang
    # mot exception khong ai bat — giet luon `_alert_loop`: alert ngung han cho
    # toi lan restart, khong log, khong metric.
    #
    # Sua nay dong thoi xu ly JA-19: interval 20h truoc day sinh slot 03:30 sang
    # (07:30 + 20h), tuc push Telegram + email luc 3h sang — dung thu ma
    # ALERT_START_TIME/END_TIME sinh ra de chan. Gio slot do vuot `end_dt` nen
    # bi loai.
    end_dt = datetime.combine(today, ALERT_END_TIME, tzinfo=VN_TZ)
    slots: list[datetime] = []
    t = datetime.combine(today, ALERT_START_TIME, tzinfo=VN_TZ)
    while t <= end_dt:
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
    # Mount VO DIEU KIEN. Truoc day gac sau `AGUI_ENABLED` (mac dinh "0"), va
    # bien do khong he duoc ghi vao .env ma CI sinh ra tren web box — nen tren
    # production sub-app KHONG BAO GIO duoc mount, moi `POST /api/agent/` tra
    # 404, va dock AI o /applications im lang khong tra loi. Khong co log loi
    # nao vi 404 la hanh vi dung cua mot route khong ton tai.
    #
    # Dock phia frontend gio luon bat (da go NEXT_PUBLIC_COPILOT_DOCK cung ly
    # do), nen mot cong tac BAT BUOC phai bat moi hoat dong chi con la cho de
    # quen — giu lai khong duoc gi.
    from app.api.agui import close_agui, init_agui

    await init_agui(app)
    task = asyncio.create_task(_alert_loop())
    yield
    task.cancel()
    await close_agui()
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
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
app.include_router(analytics.router)
app.include_router(chat.router)
app.include_router(cv.router)
app.include_router(recommendations.router)
app.include_router(applications.router)
app.include_router(interview.router)  # OLD interview API (Q&A based)
app.include_router(interview_agent_router)  # NEW chatbot-based interview (prefix already in router)


@app.get("/", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "talentpulse-dashboard-api"}
