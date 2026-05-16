# Cron Jobs — Prefect Replacement

Khi deploy slim (không có Prefect) trên VPS 2GB, dùng cron để schedule pipeline.

## Setup

### 1. Pipeline box (có thể local laptop hoặc separate VPS)

Pipeline (crawler + dbt) **không cần chạy trên VPS production**.
- Chạy local laptop hoặc 1 cheap box riêng (có thể 1 GB RAM đủ, pipeline là batch)
- Output: push vào Postgres production qua SSH tunnel hoặc public port

### 2. Cron setup trên pipeline box

```bash
crontab -e
```

Thêm:

```cron
# Daily crawl + load at 02:00
0 2 * * * cd /path/to/pipeline_data && /path/to/.venv/bin/python -m src.crawlers.vietnamworks.listing >> /var/log/tp-crawler.log 2>&1

# Detail crawl at 02:30 (after listings)
30 2 * * * cd /path/to/pipeline_data && /path/to/.venv/bin/python -m src.crawlers.vietnamworks.detail.main >> /var/log/tp-detail.log 2>&1

# Parse + load at 03:00
0 3 * * * cd /path/to/pipeline_data && /path/to/.venv/bin/python -m src.loaders.job_detail_loader >> /var/log/tp-loader.log 2>&1

# dbt build at 03:30
30 3 * * * cd /path/to/pipeline_data/dbt_transform && DBT_PROFILES_DIR=. /path/to/.venv/bin/dbt build >> /var/log/tp-dbt.log 2>&1

# Alert dispatch at 07:00 and 12:00 (after pipeline data is fresh)
0 7,12 * * * cd /path/to/pipeline_data && DASHBOARD_API_URL=http://tp-backend:8001 TELEGRAM_WEBHOOK_SECRET=YOUR_SECRET bash scripts/dispatch_alerts.sh >> /var/log/tp-alerts.log 2>&1

# Weekly log rotation
0 0 * * 0 find /var/log/tp-*.log -size +10M -exec truncate -s 0 {} \;
```

### 3. Alternative: systemd timer (cleaner than cron)

`/etc/systemd/system/talentpulse-daily.service`:
```ini
[Unit]
Description=TalentPulse daily pipeline run
After=network.target

[Service]
Type=oneshot
User=talentpulse
WorkingDirectory=/home/talentpulse/pipeline_data
Environment="DBT_PROFILES_DIR=/home/talentpulse/pipeline_data/dbt_transform"
ExecStart=/home/talentpulse/pipeline_data/scripts/daily_run.sh
StandardOutput=journal
StandardError=journal
```

`/etc/systemd/system/talentpulse-daily.timer`:
```ini
[Unit]
Description=Run TalentPulse pipeline daily at 02:00

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable:
```bash
sudo systemctl enable --now talentpulse-daily.timer
sudo systemctl list-timers | grep talentpulse
```

View logs:
```bash
sudo journalctl -u talentpulse-daily.service -f
```

### 4. Wrapper script

`pipeline_data/scripts/daily_run.sh`:
```bash
#!/bin/bash
set -euo pipefail

LOGFILE=/var/log/talentpulse/daily-$(date +%F).log
mkdir -p "$(dirname "$LOGFILE")"

{
  echo "=== START $(date -Iseconds) ==="

  echo "[1/4] Crawling listings..."
  python -m src.crawlers.vietnamworks.listing

  echo "[2/4] Crawling details..."
  python -m src.crawlers.vietnamworks.detail.main

  echo "[3/4] Loading to Postgres..."
  python -m src.loaders.job_detail_loader

  echo "[4/4] Running dbt..."
  cd dbt_transform
  dbt build

  echo "=== END $(date -Iseconds) ==="
} >> "$LOGFILE" 2>&1
```

`chmod +x scripts/daily_run.sh`.

## Monitoring

### Pragmatic observability on cheap VPS (no Prefect):

1. **Log aggregation**: `journalctl -u talentpulse-daily`
2. **Failure alert**: Add email/Slack at end of script:
   ```bash
   if [ $? -ne 0 ]; then
       curl -X POST "https://hooks.slack.com/services/XXX/YYY/ZZZ" \
            -d '{"text":"🚨 TalentPulse pipeline failed"}'
   fi
   ```
3. **Health check endpoint**: backend `/api/overview` returns fresh data → external uptime monitoring (UptimeRobot free tier) hits it every 5 min.
4. **Data freshness SQL**:
   ```sql
   select max(parsed_at) from raw.job_detail;
   ```
   If > 36h old → pipeline broken.

## Khi nào quay lại Prefect?

Nếu cần một trong:
- Multi-flow orchestration (TopCV + Glints + VNW chạy song song)
- Dependency giữa flows (không chạy dbt nếu loader fail)
- Web UI debug cho team > 1 người
- Dynamic scheduling (retry với backoff, on-failure hooks phức tạp)
- SLA enforcement (flow phải < 30 phút)

→ Add Prefect back với 4GB box hoặc Prefect Cloud free tier (3 users, unlimited flow runs).
