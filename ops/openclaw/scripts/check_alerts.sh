#!/usr/bin/env bash
# Kiem tra dinh ky: chi IN ra van de. Khong co van de -> in NO_REPLY (OpenClaw
# se im lang, khong gui gi). Chay boi automation cron cua OpenClaw.
set -uo pipefail

DB_URL="${TP_DB_URL:-postgresql://metabase_ro@127.0.0.1:5432/warehouse}"
PY="python"
PROBLEMS=""

# 1) Disk > 85%
disk_pct=$(df -h / | tail -1 | awk '{gsub(/%/,"",$5); print $5}')
if [ -n "${disk_pct:-}" ] && [ "$disk_pct" -gt 85 ]; then
  PROBLEMS+="- ⚠️ DISK: $disk_pct% da dung. Goi y: docker system prune -af (nho nguoi quan ly duyet).\n"
fi

# 2) Backend container chet
if ! docker ps --filter "name=tp-backend" --filter "status=running" -q 2>/dev/null | grep -q .; then
  PROBLEMS+="- 🚨 BACKEND: container tp-backend KHONG chay. Kiem tra: docker compose ps.\n"
fi

# 3) Crawl im lang: khong co job moi trong 36h
fresh=$("$PY" /ops/openclaw/scripts/db_query.py --db-url "$DB_URL" --sql \
  "SELECT count(*) FROM dbt_dev_gold.fct_jobs_daily WHERE snapshot_date >= now() - interval '36 hours'" 2>/dev/null | tr -d '[:space:]')
if [ -n "${fresh:-}" ] && [ "$fresh" -eq 0 ]; then
  PROBLEMS+="- 📉 CRAWL: khong co snapshot job moi trong 36h — pipeline co the chet im lang.\n"
fi

if [ -z "$PROBLEMS" ]; then
  echo "NO_REPLY"
else
  echo -e "Kiem tra dinh ky phat hien:\n$PROBLEMS"
fi
