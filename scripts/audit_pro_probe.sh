#!/bin/bash
set -e
BASE=${BASE:-https://talentpuse.io.vn}
PRO_TOKEN=${PRO_TOKEN:?set PRO_TOKEN}
FREE_TOKEN=${FREE_TOKEN:-$PRO_TOKEN}
echo "== health anon → 401 =="; code=$(curl -s -o /dev/null -w "%{http_code}" $BASE/api/pro/health); echo $code
echo "== health pro =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/health?date_from=2026-01-01" | jq '{missing_pct,gap_days,llm,total_jd,extracted}' || true
echo "== free blocked =="; curl -s -H "Authorization: Bearer $FREE_TOKEN" $BASE/api/pro/skills/top | head -c 200
for ep in skills/top tools/top languages/top benefits/top requirements/experience; do echo "== $ep =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/$ep?limit=5" | jq length; done
echo "== export raw =="; curl -s -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/export.xlsx?kind=raw&title=Engineer%25&limit=5" -o /tmp/audit_raw.xlsx && ls -lh /tmp/audit_raw.xlsx
echo "== report =="; curl -s -X POST -H "Authorization: Bearer $PRO_TOKEN" "$BASE/api/pro/report?category=AI" | jq .narrative | cut -c1-200
