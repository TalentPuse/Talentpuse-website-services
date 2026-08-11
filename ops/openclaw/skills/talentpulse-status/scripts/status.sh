#!/usr/bin/env bash
# So lieu kinh doanh nhanh — chay cac cau SELECT dinh san, chi-doc.
# Can TP_DB_URL (postgresql://metabase_ro:...@127.0.0.1:5432/warehouse) trong env.
set -uo pipefail

DB_URL="${TP_DB_URL:-postgresql://metabase_ro@127.0.0.1:5432/warehouse}"
PY="python"  # co the doi thanh duong dan python day du tren box

echo "=== USER (tong + moi 7 ngay) ==="
"$PY" /ops/openclaw/scripts/db_query.py --db-url "$DB_URL" --sql \
  "SELECT (SELECT count(*) FROM app.users) AS tong_user,
          (SELECT count(*) FROM app.users WHERE created_at >= now() - interval '7 days') AS user_moi_7ngay" 2>/dev/null || echo "(loi query user)"

echo ""
echo "=== JOB ACTIVE (tong + theo nguon) ==="
"$PY" /ops/openclaw/scripts/db_query.py --db-url "$DB_URL" --sql \
  "SELECT source, count(DISTINCT source_job_id) FROM dbt_dev_gold.fct_jobs_daily WHERE is_active GROUP BY source ORDER BY 2 DESC" 2>/dev/null || echo "(loi query job)"

echo ""
echo "=== ALERT 7 NGAY (tong, fail) ==="
"$PY" /ops/openclaw/scripts/db_query.py --db-url "$DB_URL" --sql \
  "SELECT count(*) AS tong_alert,
          count(*) FILTER (WHERE status = 'failed') AS alert_fail
   FROM app.alert_logs WHERE created_at >= now() - interval '7 days'" 2>/dev/null || echo "(loi query alert)"
