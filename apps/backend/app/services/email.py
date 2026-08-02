"""Email alert service using Resend API."""
from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.core.config import RESEND_API_KEY, RESEND_FROM_EMAIL
from app.core.unsubscribe import tao_token
from app.services.job_matcher import MatchedJob, SOURCE_LABEL, _build_job_url

logger = logging.getLogger(__name__)

RESEND_API = "https://api.resend.com/emails"


@dataclass
class EmailResult:
    success: bool
    message_id: str | None = None
    error: str | None = None


BASE_URL = "https://talentpuse.io.vn"
API_BASE_URL = "https://talentpuse.io.vn/api"


def _unsubscribe_url(user_id) -> str | None:
    if user_id is None:
        return None
    return f"{API_BASE_URL}/email/alerts/unsubscribe/one-click?token={tao_token(user_id)}"


async def send_job_alert_email(
    to: str,
    user_name: str,
    jobs: list[MatchedJob],
    user_id=None,
) -> EmailResult:
    """Send a job alert email via Resend API.

    Returns EmailResult with success status and optional message_id or error.
    """
    if not jobs:
        return EmailResult(success=False, error="No jobs to send")

    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set, skipping email send")
        return EmailResult(success=False, error="RESEND_API_KEY not configured")

    subject = f"TalentPulse Alert: {len(jobs)} viec lam moi phu hop"
    huy_url = _unsubscribe_url(user_id)
    html = _build_job_alert_html(user_name, jobs, huy_url)

    # Gmail va Yahoo BAT BUOC bulk sender phai co one-click unsubscribe
    # (RFC 8058) — thieu no thi ca domain gui bi ha uy tin, khong chi rieng
    # nhung mail bi bam Report spam (JA-22).
    #
    # `List-Unsubscribe-Post` la phan lam cho no "one-click": khong co header
    # nay, mail client chi hien link va nguoi dung phai tu bam.
    headers = {}
    if huy_url:
        headers = {
            "List-Unsubscribe": f"<{huy_url}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                RESEND_API,
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": RESEND_FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    **({"headers": headers} if headers else {}),
                },
            )

        if resp.status_code in (200, 201):
            data = resp.json()
            msg_id = data.get("id")
            logger.info("Email sent to %s (id=%s)", to, msg_id)
            return EmailResult(success=True, message_id=msg_id)

        logger.error("Resend API error %d: %s", resp.status_code, resp.text)
        return EmailResult(success=False, error=f"HTTP {resp.status_code}: {resp.text[:200]}")

    except Exception as exc:
        logger.exception("Failed to send email to %s", to)
        return EmailResult(success=False, error=str(exc))


def _build_job_alert_html(user_name: str, jobs: list[MatchedJob], huy_url: str | None = None) -> str:
    """Build HTML email content for job alerts."""
    job_cards = ""
    for i, job in enumerate(jobs, 1):
        title = job.title or "Khong ro"
        company = job.company_name or "Khong ro"
        city = job.city_raw_vi or job.city_canonical or ""
        level = job.job_level or ""
        salary = job.salary_m
        url = _build_job_url(job)
        source_label = SOURCE_LABEL.get(job.source, job.source)
        score_text = f'<span style="color:#f59e0b;">&#9733; {job.score:.0f}%</span>' if job.score else ""

        salary_html = ""
        if salary:
            salary_html = f'<span style="background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;">~{salary:.0f} trieu/thang</span>'

        job_cards += f"""
        <tr>
          <td style="padding:16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="color:#94a3b8;font-size:12px;font-weight:600;">#{i}</span>
                  <span style="background:#eff6ff;color:#2563eb;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:6px;">{source_label}</span>
                  {score_text}
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  <h3 style="margin:0;font-size:16px;font-weight:600;color:#0f172a;">{title}</h3>
                </td>
              </tr>
              <tr>
                <td style="padding-top:4px;color:#64748b;font-size:14px;">
                  {company}{' &middot; ' + city if city else ''}
                  {' &middot; ' + level if level else ''}
                </td>
              </tr>
              <tr>
                <td style="padding-top:8px;">
                  {salary_html}
                  <a href="{url}" style="color:#2563eb;font-size:13px;text-decoration:none;margin-left:12px;">Xem chi tiet &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        """

    # Link huy PHAI nam trong noi dung mail, khong chi trong header: nguoi doc
    # tren mobile thuong khong thay nut Unsubscribe cua mail client. Muon huy
    # ma phai dang nhap thi phan lon se bam "Report spam" thay the (JA-22).
    huy_html = (
        f'''<p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">
                <a href="{huy_url}" style="color:#94a3b8;text-decoration:underline;">Huy nhan email nay</a>
              </p>'''
        if huy_url
        else ""
    )

    return f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">TalentPulse Alert</h1>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">Xin chao {user_name}, co <strong style="color:#ffffff;">{len(jobs)}</strong> viec lam moi phu hop voi ban.</p>
            </td>
          </tr>
          <!-- Jobs -->
          <tr>
            <td style="padding:16px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                {job_cards}
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:16px 24px;border-radius:0 0 12px 12px;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:12px;">
                Cap nhat ho so tai <a href="https://talentpuse.io.vn/profile" style="color:#2563eb;">talentpuse.io.vn/profile</a> de nhan alert chinh xac hon.
              </p>
              <p style="margin:8px 0 0;color:#94a3b8;font-size:11px;">
                &copy; 2026 TalentPulse. Ban nhan email vi dang ky nhan thong bao viec lam.
              </p>
              {huy_html}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    """.strip()
