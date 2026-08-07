"""Web box Prefect flow — extract JD insight hang ngay.

Goi endpoint noi bo /api/admin/jd/extract (webhook secret nhu alert).
Lich: 17:00 VN — sau khi warehouse sync job moi ve.

KHONG co block __main__/serve() o day: alerts.py la entry chuan, no import
flow nay vao chung mot `serve(...)` de tranh deployment trung lap.
"""
from __future__ import annotations

import os
import time

import httpx
from prefect import flow, get_run_logger, task
from prefect.artifacts import create_markdown_artifact
from prefect.client.schemas.schedules import CronSchedule

# Lich cua flow nay — alerts.py la entry chuan va serve deployment
# jd-extract-daily voi chinh hang so nay (import lai, khong dinh nghia nua).
_CRON_JD = CronSchedule(cron="0 17 * * *", timezone="Asia/Ho_Chi_Minh")


@task(name="jd_extract", timeout_seconds=1800)
def _extract() -> dict:
    logger = get_run_logger()
    url = os.getenv("DASHBOARD_API_URL", "http://tp-backend:8001")
    secret = os.getenv("ALERT_DISPATCH_SECRET") or os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    try:
        resp = httpx.post(
            f"{url}/api/admin/jd/extract",
            headers={"X-Webhook-Secret": secret, "X-Extract-Limit": "200"},
            timeout=1700,
        )
        resp.raise_for_status()
        result = resp.json()
        logger.info("JD extract xong: %s jobs", result.get("extracted", 0))
        return result
    except Exception as exc:
        logger.error("JD extract fail: %s", exc)
        return {"extracted": 0, "error": str(exc)}


@flow(name="jd-extract")
def jd_extract_flow() -> dict:
    t0 = time.time()
    result = _extract()
    dur = time.time() - t0
    extracted = result.get("extracted", 0)
    error = result.get("error")
    status = "success" if not error else f"error: {error}"
    create_markdown_artifact(
        markdown=(
            f"## JD Extract\n"
            f"| Metric | Value |\n|--------|-------|\n"
            f"| Extracted | {extracted} |\n"
            f"| Status | {status} |\n"
            f"| Duration | {dur:.1f}s |"
        ),
        key="jd-extract-result",
        description=f"JD extract: {extracted} jobs ({status})",
    )
    return result
