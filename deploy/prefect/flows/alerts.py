"""Web box Prefect flows — alert dispatch tach theo kenh.

Hai pipeline RIENG, doc lap (chay cung worker nhung hai deployment, hai lich,
hai luong run rieng trong UI):

  - alert-telegram-daily  -> POST /api/admin/alerts/dispatch-internal
                             voi X-Dispatch-Channels: telegram
  - alert-email-daily     -> ... voi X-Dispatch-Channels: email

Backend tu lo dedup rieng tung kenh (xem _dispatch_alerts_locked trong
app/services/job_alert.py): pipeline telegram dedup theo website marker,
pipeline email dedup theo dong email 'sent' — nen user co ca 2 kenh van nhan
ca 2, khong chan nhau.

Lich ca hai: 07:00 + 12:00 gio VN (cron mac dinh cua Prefect la UTC nen phai
chi ro timezone). Muon doi gio rieng cho tung kenh thi sua _CRON_VN.

LUU Y: phai la hai ham @flow rieng biet (alert_telegram_flow / alert_email_flow)
chu khong duoc sinh bang factory — Prefect resolve entrypoint theo TEN HAM,
hai deployment cung ten ham `_flow` se khong load duoc flow.
"""
from __future__ import annotations

import os
import time

import httpx
from prefect import flow, get_run_logger, task
from prefect.artifacts import create_markdown_artifact
from prefect.client.schemas.schedules import CronSchedule

# Lich cua flow JD lay tu flows.jd_extract — nguon duy nhat, tranh lech cron.
from flows.jd_extract import _CRON_JD

# Sync du lieu tu warehouse box chay ~11:00-17:00 VN (da do nhieu ngay:
# max loaded 08-03 16:56 VN). Cron 7,12 VN chay TRUOC sync nen alert luon
# 0 job moi. Doi sang SAU sync, 5 lan/ngay: 18, 19, 20, 21, 22 VN. Moi slot
# chi gui job MOI (dedup kenh website) nen slot gan nhau khong gui trung.
_CRON_VN = CronSchedule(cron="0 18,19,20,21,22 * * *", timezone="Asia/Ho_Chi_Minh")


@task(name="dispatch_alerts", retries=2, retry_delay_seconds=30, timeout_seconds=180)
def _dispatch(channels: str) -> dict:
    logger = get_run_logger()
    url = os.getenv("DASHBOARD_API_URL", "http://tp-backend:8001")
    secret = os.getenv("ALERT_DISPATCH_SECRET") or os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    try:
        resp = httpx.post(
            f"{url}/api/admin/alerts/dispatch-internal",
            headers={
                "X-Webhook-Secret": secret,
                "X-Dispatch-Source": f"alert_{channels}_flow",
                "X-Dispatch-Channels": channels,
            },
            timeout=120,
        )
        resp.raise_for_status()
        result = resp.json()
        dispatched = result.get("dispatched", 0)
        logger.info("Dashboard alerts dispatched (%s): %s jobs", channels, dispatched)
        return result
    except Exception as exc:
        logger.error("Alert dispatch (%s) failed: %s", channels, exc)
        return {"dispatched": 0, "error": str(exc)}


def _run_and_report(channels: str) -> dict:
    t0 = time.time()
    result = _dispatch(channels)
    dur = time.time() - t0
    dispatched = result.get("dispatched", 0)
    error = result.get("error")

    status = "success" if not error else f"error: {error}"
    create_markdown_artifact(
        markdown=(
            f"## Alert Dispatch ({channels})\n"
            f"| Metric | Value |\n|--------|-------|\n"
            f"| Dispatched | {dispatched} |\n"
            f"| Status | {status} |\n"
            f"| Duration | {dur:.1f}s |"
        ),
        key=f"alert-{channels}-result",
        description=f"Alert dispatch ({channels}): {dispatched} jobs ({status})",
    )
    return result


@flow(name="alert-telegram")
def alert_telegram_flow() -> dict:
    """Dispatch TELEGRAM job alerts to all active users."""
    return _run_and_report("telegram")


@flow(name="alert-email")
def alert_email_flow() -> dict:
    """Dispatch EMAIL job alerts to all active users."""
    return _run_and_report("email")


if __name__ == "__main__":
    if os.getenv("PREFECT_DEPLOY", "0") == "1":
        from prefect import serve

        from flows.jd_extract import jd_extract_flow

        serve(
            alert_telegram_flow.to_deployment(
                name="alert-telegram-daily",
                schedules=[_CRON_VN],
                tags=["alerts", "telegram"],
            ),
            alert_email_flow.to_deployment(
                name="alert-email-daily",
                schedules=[_CRON_VN],
                tags=["alerts", "email"],
            ),
            jd_extract_flow.to_deployment(
                name="jd-extract-daily",
                schedules=[_CRON_JD],
                tags=["jdi"],
            ),
        )
    else:
        alert_telegram_flow()
        alert_email_flow()
