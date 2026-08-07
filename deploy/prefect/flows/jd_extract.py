"""Web box Prefect flow — extract JD insight hang ngay.

Goi endpoint noi bo /api/admin/jd/extract (webhook secret nhu alert).
Lich: 17:00 VN — sau khi warehouse sync job moi ve.
"""
from __future__ import annotations

import os

import httpx
from prefect import flow, get_run_logger, task
from prefect.artifacts import create_markdown_artifact
from prefect.client.schemas.schedules import CronSchedule

_CRON_VN = CronSchedule(cron="0 17 * * *", timezone="Asia/Ho_Chi_Minh")


@task(name="jd_extract", retries=2, retry_delay_seconds=60, timeout_seconds=1800)
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
    result = _extract()
    create_markdown_artifact(
        markdown=f"## JD Extract\n| Extracted | {result.get('extracted', 0)} |",
        key="jd-extract-result",
        description=f"JD extract: {result.get('extracted', 0)} jobs",
    )
    return result


if __name__ == "__main__":
    if os.getenv("PREFECT_DEPLOY", "0") == "1":
        from prefect import serve

        serve(
            jd_extract_flow.to_deployment(
                name="jd-extract-daily",
                schedules=[_CRON_VN],
                tags=["jdi"],
            ),
        )
    else:
        jd_extract_flow()
