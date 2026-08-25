# TalentPuse

Monorepo: backend (FastAPI) + frontend (Next.js) + MCP warehouse server.

- `apps/backend`  — FastAPI
- `apps/frontend` — Next.js 14
- `apps/mcp`      — FastMCP warehouse server

Moi app deploy doc lap qua GitHub Actions (xem `.github/workflows/`).

## Pro Insights (Pro only)

Pro-gated analytics over `app.jd_insight` (extracted from warehouse `silver_job_detail` via LLM). Requires `subscription_tier=pro` or `is_admin`.

- Frontend: `/pro-insights` — 5 charts (skills/tools/languages/benefits/experience), filters by category/city, export XLSX, per-category report.
- Backend: `apps/backend/app/api/pro.py` — 8 routes (`/health`, `/skills/top`, `/tools/top`, `/languages/top`, `/benefits/top`, `/requirements/experience`, `/export.xlsx`, `/report`, `/jobs/{source}/{id}/insight`).

**Handover health check:**

```bash
curl -H "Authorization: Bearer $PRO_TOKEN" http://localhost:8001/api/pro/health | jq
# assert total_jd, extracted, gap_days
```

```
GET /api/pro/health — shows missing_pct, gap_days, llm health for handover.
If missing >5% or gap_days >3: POST /api/admin/jd/extract -H X-Webhook-Secret
```

Probe script (handover verification): `PRO_TOKEN=... FREE_TOKEN=... bash scripts/audit_pro_probe.sh` (BASE defaults to `https://talentpuse.io.vn`; checks health anon 401, pro health, free blocked, 5 Pro endpoints, export raw, report).

Fallback extract (Prefect daily + manual):

```bash
curl -X POST http://localhost:8001/api/admin/jd/extract \
  -H "X-Webhook-Secret: $TELEGRAM_WEBHOOK_SECRET" \
  -H "X-Extract-Limit: 50" | jq
# {"extracted": <n>}
```
