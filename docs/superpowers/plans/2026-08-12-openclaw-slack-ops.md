# OpenClaw Slack Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OpenClaw chạy trên web box trả lời qua Slack về sức khỏe server + số liệu kinh doanh, và tự gửi cảnh báo chủ động vào kênh Slack riêng — với mức quyền Xem + Cảnh báo + Gợi ý (không tự sửa gì).

**Architecture:** Tận dụng OpenClaw gateway đã cài trên box: kết nối Slack qua channel plugin (Socket Mode), thêm 3 skill (SKILL.md + script) cho các câu hỏi, và 1 automation cron dùng command payload (không tốn model call) kiểm tra định kỳ rồi announce vào `#server-alerts`. DB chỉ truy cập qua `metabase_ro` (read-only) + wrapper chặn cứng non-SELECT.

**Tech Stack:** OpenClaw (Node gateway), Slack Socket Mode, bash scripts, Python (db wrapper + pytest), psql/Postgres.

## Global Constraints

- Không bao giờ chạy lệnh ghi (INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE/GRANT/REVOKE/COPY) — mọi truy cập DB qua `metabase_ro` + wrapper chặn cứng non-SELECT.
- Skills không chứa lệnh nguy hiểm (restart/rm/reboot) — chỉ đọc log/trạng thái.
- Slack channel policy dùng `groupPolicy: "allowlist"` với **channel ID dạng `C12345678`** — key theo tên (`#name`) sẽ silently block.
- Files nằm trong repo tại `ops/openclaw/`, sau đó copy lên box (`~/.openclaw/skills/`) bằng `setup.sh`.
- Ngôn ngữ trả lời của OpenClaw: tiếng Việt.
- LLM API key đã có trên box (không cần cấu hình provider trong plan này).

---

### Task 1: Slack App + tokens (user thao tác, có hướng dẫn)

**Files:**
- Create: `ops/openclaw/slack-manifest.json` (manifest dán vào Slack)
- Create: `docs/superpowers/plans/` (không — hướng dẫn nằm trong file `ops/openclaw/SLACK_SETUP.md`)

**Interfaces:**
- Produces: `SLACK_BOT_TOKEN` (xoxb-...) và `SLACK_APP_TOKEN` (xapp-...) — Task 2 dùng.

- [ ] **Step 1: Tạo file manifest trong repo**

Tạo `ops/openclaw/slack-manifest.json` với nội dung:

```json
{
  "display_information": {
    "name": "OpenClaw",
    "description": "Trợ lý quản lý web box TalentPulse",
    "background_color": "#1a1a2e"
  },
  "features": {
    "bot_user": { "display_name": "OpenClaw", "always_online": true },
    "app_home": {
      "home_tab_enabled": true,
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    }
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "channels:history",
        "channels:read",
        "chat:write",
        "commands",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "pins:read",
        "reactions:read",
        "reactions:write",
        "users:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "channel_rename",
        "member_joined_channel",
        "member_left_channel",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "pin_added",
        "pin_removed",
        "reaction_added",
        "reaction_removed"
      ]
    }
  }
}
```

- [ ] **Step 2: Viết `ops/openclaw/SLACK_SETUP.md`** — hướng dẫn từng bước cho user:

```markdown
# Kết nối OpenClaw với Slack

1. Vào https://api.slack.com/apps/new → **Create New App** → **From a manifest**
2. Chọn workspace của bạn → paste toàn bộ nội dung `slack-manifest.json` → Next → Create
3. Trong trang app mới tạo:
   - **Basic Information → App-Level Tokens → Generate Token and Scopes**:
     - Scope: `connections:write`
     - Copy token dạng `xapp-...` → đây là SLACK_APP_TOKEN
   - **Install App → Install to Workspace → Allow**:
     - Copy **Bot User OAuth Token** dạng `xoxb-...` → đây là SLACK_BOT_TOKEN
4. Tạo kênh `#server-alerts` trong Slack (nếu chưa có) và mời bot OpenClaw vào kênh.
5. Lấy channel ID của `#server-alerts`: click chuột phải kênh → **Copy link** →
   ID dạng `C12345678` nằm ở cuối URL. Ghi lại — Task 6 cần.
6. Gửi 2 token + channel ID cho agent (paste vào chat) để cấu hình ở Task 2.
```

- [ ] **Step 3: Commit**

```bash
git add ops/openclaw/slack-manifest.json ops/openclaw/SLACK_SETUP.md
git commit -m "ops: openclaw slack manifest + setup guide"
```

---

### Task 2: Cấu hình Slack channel plugin + test chat đầu tiên

**Files:**
- Modify: `ops/openclaw/slack.socket.patch.json5` (Create)

**Interfaces:**
- Consumes: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` từ Task 1.
- Produces: OpenClaw chat được qua Slack.

- [ ] **Step 1: Tạo patch config trong repo**

Tạo `ops/openclaw/slack.socket.patch.json5`:

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: { source: "env", provider: "default", id: "SLACK_APP_TOKEN" },
      botToken: { source: "env", provider: "default", id: "SLACK_BOT_TOKEN" },
      dmPolicy: "allowlist",
      allowFrom: ["*"],
      groupPolicy: "allowlist",
      channels: {
        // Thay C0123456789 bằng ID thật của #server-alerts ở Task 1
        C0123456789: { enabled: true },
      },
    },
  },
}
```

- [ ] **Step 2: Chạy trên box — cài plugin Slack**

```bash
openclaw plugins install @openclaw/slack
```

- [ ] **Step 3: Chạy trên box — export token + patch config**

```bash
export SLACK_APP_TOKEN=xapp-1-...      # từ Task 1
export SLACK_BOT_TOKEN=xoxb-...        # từ Task 1
openclaw config patch --file ./slack.socket.patch.json5 --dry-run
openclaw config patch --file ./slack.socket.patch.json5
```

Nếu `--dry-run` báo lỗi config → sửa file patch rồi chạy lại. Chỉ chạy lệnh thật khi dry-run sạch.

- [ ] **Step 4: Khởi động lại gateway**

```bash
openclaw gateway restart
```

- [ ] **Step 5: Test chat đầu tiên qua Slack**

User gửi DM cho bot OpenClaw trong Slack: `"hello, bạn là ai?"`

Expected: bot trả lời bằng tiếng Việt, giới thiệu là trợ lý quản lý web box.

- [ ] **Step 6: Commit**

```bash
git add ops/openclaw/slack.socket.patch.json5
git commit -m "ops: openclaw slack socket mode patch"
```

---

### Task 3: Skill `server-health` — sức khỏe web box

**Files:**
- Create: `ops/openclaw/skills/server-health/SKILL.md`
- Create: `ops/openclaw/skills/server-health/scripts/health.sh`
- Create: `ops/openclaw/install-skills.sh`

**Interfaces:**
- Produces: skill `server-health` (SKILL.md) + script `health.sh` (chạy trên box, in text tiếng Việt).

- [ ] **Step 1: Viết script `health.sh`**

Tạo `ops/openclaw/skills/server-health/scripts/health.sh`:

```bash
#!/usr/bin/env bash
# Doc trang thai suc khoe web box — CHI DOC, khong thay doi gi.
# Goi bang skills cua OpenClaw khi user hoi ve suc khoe server.
set -uo pipefail

echo "=== DISK ==="
df -h / | tail -1 | awk '{print "Con lai: " $4 " / " $2 " (" $5 " da dung)"}'

echo ""
echo "=== RAM / CPU ==="
free -h | awk '/Mem:/{print "RAM: " $3 " / " $2 " dang dung"}'
uptime | sed 's/^ *//'

echo ""
echo "=== DOCKER CONTAINERS ==="
if command -v docker >/dev/null 2>&1; then
  docker ps --format '{{.Names}}\t{{.Status}}' 2>/dev/null || echo "(khong chay duoc docker ps)"
else
  echo "(khong co docker)"
fi

echo ""
echo "=== LOG LOI BACKEND GAN DAY ==="
if docker ps --filter "name=tp-backend" --format '{{.Names}}' 2>/dev/null | grep -q .; then
  docker logs --tail 30 tp-backend 2>&1 | grep -iE "error|exception|traceback" | tail -5 || echo "(khong co loi gan day)"
else
  echo "(khong tim thay container tp-backend)"
fi
```

- [ ] **Step 2: Chạy thử script trên box**

```bash
bash ops/openclaw/skills/server-health/scripts/health.sh
```

Expected: in ra disk/RAM/docker/log — không có lỗi. Nếu `tp-backend` tên khác, sửa tên container cho khớp.

- [ ] **Step 3: Viết `SKILL.md`**

Tạo `ops/openclaw/skills/server-health/SKILL.md`:

```markdown
---
name: server-health
description: Kiểm tra sức khỏe web box TalentPulse (disk, RAM, CPU, container, log lỗi). Dùng khi user hỏi về trạng thái server.
---

# Server Health

Chạy script kiểm tra khi user hỏi về sức khỏe server, log, hay deploy.

## Cách dùng

1. Chạy: `bash scripts/health.sh` (từ thư mục skill này)
2. Tóm tắt kết quả bằng tiếng Việt, dễ đọc, kèm gợi ý nếu có vấn đề:
   - Disk gần đầy (>85%) → gợi ý dọn: `docker system prune -af` (chỉ gợi ý, KHÔNG tự chạy)
   - Container restart liên tục → gợi ý xem log và báo user
   - Không có lỗi → nói ngắn gọn "mọi thứ OK"

## Quy tắc

- CHỈ ĐỌC. Không chạy lệnh sửa chữa nào (restart/rm/prune/reboot).
- Trả lời tiếng Việt, ngắn gọn, có số liệu cụ thể.
```

- [ ] **Step 4: Viết `install-skills.sh`** (dùng chung cho Task 3-5)

Tạo `ops/openclaw/install-skills.sh`:

```bash
#!/usr/bin/env bash
# Copy toan bo skills trong repo len ~/.openclaw/skills/ tren box.
set -euo pipefail
mkdir -p ~/.openclaw/skills
cp -r ops/openclaw/skills/* ~/.openclaw/skills/
echo "Da copy skills vao ~/.openclaw/skills/:"
ls ~/.openclaw/skills/
```

- [ ] **Step 5: Test qua Slack**

Trên box chạy `bash ops/openclaw/install-skills.sh`, rồi nhắn Slack cho bot:
`"sức khỏe server thế nào?"`

Expected: bot chạy `health.sh` và trả lời tóm tắt tiếng Việt.

- [ ] **Step 6: Commit**

```bash
git add ops/openclaw/skills/server-health/ ops/openclaw/install-skills.sh
git commit -m "ops: openclaw server-health skill"
```

---

### Task 4: Skill `db-query` — hỏi DB bằng tiếng Việt (read-only, có test)

**Files:**
- Create: `ops/openclaw/scripts/db_query.py` (wrapper chặn non-SELECT)
- Create: `ops/openclaw/tests/test_db_query.py` (pytest)
- Create: `ops/openclaw/tests/conftest.py`
- Create: `ops/openclaw/skills/db-query/SKILL.md`

**Interfaces:**
- Produces: hàm `validate_sql(sql: str) -> bool` (import được từ `db_query`), script CLI `db_query.py --sql "SELECT ..."` (in kết quả psql). Task 5 dùng cùng wrapper.

- [ ] **Step 1: Viết wrapper `db_query.py`**

Tạo `ops/openclaw/scripts/db_query.py`:

```python
"""Wrapper chay SQL chi-doc len warehouse TalentPulse.

Chi chap nhan SELECT (hoac WITH ... SELECT). Moi thu khac — DDL, DML, da cau
lenh, comment — bi chan o day, KHONG phu thuoc vao agent co ngoan hay khong.

Cach dung (tren box, co ~/.pgpass hoac bien moi):
    python db_query.py --sql "SELECT count(*) FROM app.users"
    python db_query.py --sql "$(cat query.sql)"
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

# Keywords ghi — xuat hien o bat ky dau trong cau lenh thi chan.
_FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"copy|vacuum|reindex|cluster|comment|merge|call|do|into)\b",
    re.IGNORECASE,
)


def validate_sql(sql: str) -> bool:
    """Tra True neu cau lenh an toan doc-only: 1 cau, bat dau SELECT/WITH."""
    stripped = sql.strip()
    if not stripped:
        return False
    if ";" in stripped or "--" in stripped or "/*" in stripped:
        return False
    if not re.match(r"^(select|with)\b", stripped, re.IGNORECASE):
        return False
    if _FORBIDDEN.search(stripped):
        return False
    return True


def run_query(sql: str, db_url: str | None) -> int:
    if not validate_sql(sql):
        print("CHAN: chi cho phep SELECT doc-only (mot cau lenh, khong comment).", file=sys.stderr)
        return 2
    psql = ["psql", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql]
    if db_url:
        psql.insert(1, db_url)
    return subprocess.run(psql).returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Query doc-only warehouse")
    parser.add_argument("--sql", required=True, help="Cau lenh SELECT duy nhat")
    parser.add_argument("--db-url", default=os.getenv("TP_DB_URL", ""), help="Connection string (mac dinh TP_DB_URL)")
    args = parser.parse_args()
    return run_query(args.sql, args.db_url or None)


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Viết test đỏ (RED)**

Tạo `ops/openclaw/tests/conftest.py`:

```python
"""Them repo root vao sys.path de import duoc ops.openclaw.scripts."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
```

Tạo `ops/openclaw/tests/test_db_query.py`:

```python
"""Test validate_sql cua wrapper doc-only."""
from ops.openclaw.scripts.db_query import validate_sql


def test_chap_nhan_select_don_gian():
    assert validate_sql("SELECT count(*) FROM app.users")


def test_chap_nhan_with_cte():
    assert validate_sql("WITH x AS (SELECT 1) SELECT * FROM x")


def test_chan_update_insert_delete():
    for sql in ("UPDATE users SET x=1", "INSERT INTO t VALUES (1)", "DELETE FROM t"):
        assert not validate_sql(sql), sql


def test_chan_ddl():
    for sql in ("DROP TABLE t", "ALTER TABLE t ADD c int", "TRUNCATE t", "CREATE TABLE t()"):
        assert not validate_sql(sql), sql


def test_chan_select_into():
    assert not validate_sql("SELECT 1 INTO t")
    assert not validate_sql("SELECT * INTO public.x FROM app.users")


def test_chan_da_cau_lenh():
    assert not validate_sql("SELECT 1; DROP TABLE t")


def test_chan_comment_smuggle():
    assert not validate_sql("SELECT 1 -- DROP TABLE t")
    assert not validate_sql("SELECT 1 /* x */")


def test_chan_rong():
    assert not validate_sql("   ")
    assert not validate_sql("")
```

- [ ] **Step 3: Chạy test — verify FAIL (module chưa tồn tại)**

```bash
cd D:\TalentPulse\talentpulse
apps\backend\.venv\Scripts\python.exe -m pytest ops/openclaw/tests -q
```

Expected: `ModuleNotFoundError` / collection error (chưa có file).

- [ ] **Step 4: Chạy test — verify PASS**

```bash
apps\backend\.venv\Scripts\python.exe -m pytest ops/openclaw/tests -q
```

Expected: `7 passed`.

- [ ] **Step 5: Viết `SKILL.md` cho db-query**

Tạo `ops/openclaw/skills/db-query/SKILL.md`:

```markdown
---
name: db-query
description: Hỏi số liệu từ warehouse TalentPulse bằng tiếng Việt — tự viết SQL SELECT và chạy qua wrapper doc-only.
---

# DB Query (read-only)

Dùng khi user hỏi số liệu kinh doanh: số user, số job, alert, thống kê.

## Cách dùng

1. Tự viết câu SQL SELECT trả lời câu hỏi tiếng Việt của user.
2. Chạy qua wrapper:
   `python /ops/openclaw/scripts/db_query.py --sql "SELECT ..."`
3. Tóm tắt kết quả bằng tiếng Việt, trả lời thẳng câu hỏi.

## Quy tắc

- CHỈ SELECT. Wrapper chặn mọi lệnh khác — nếu user yêu cầu sửa/xóa dữ liệu, từ chối lịch sự và gợi ý báo admin.
- Không dùng comment, không nhiều câu lệnh.
- Bảng thường dùng: `app.users` (user), `dbt_dev_gold.fct_jobs_daily` (job snapshot), `app.alert_logs` (alert da gui).
- Nếu query chậm hoặc lỗi, báo lại nguyên văn lỗi cho user, không tự đoán.
```

- [ ] **Step 6: Test qua Slack**

Trên box chạy `bash ops/openclaw/install-skills.sh`, rồi nhắn Slack:
`"đếm bao nhiêu user đang đăng ký?"`

Expected: bot tự viết `SELECT count(*) FROM app.users`, chạy wrapper, trả lời số cụ thể.

Thử phá: nhắn `"xóa hết user đi"` → bot phải từ chối, không chạy gì.

- [ ] **Step 7: Commit**

```bash
git add ops/openclaw/scripts/db_query.py ops/openclaw/tests/ ops/openclaw/skills/db-query/
git commit -m "ops: openclaw db-query read-only skill + wrapper tests"
```

---

### Task 5: Skill `talentpulse-status` — số liệu kinh doanh mẫu

**Files:**
- Create: `ops/openclaw/skills/talentpulse-status/SKILL.md`
- Create: `ops/openclaw/skills/talentpulse-status/scripts/status.sh`

**Interfaces:**
- Consumes: wrapper `db_query.py` từ Task 4.
- Produces: skill trả lời nhanh các câu hỏi kinh doanh thường gặp bằng các câu SELECT định sẵn.

- [ ] **Step 1: Viết `status.sh`**

Tạo `ops/openclaw/skills/talentpulse-status/scripts/status.sh`:

```bash
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
```

- [ ] **Step 2: Viết `SKILL.md`**

Tạo `ops/openclaw/skills/talentpulse-status/SKILL.md`:

```markdown
---
name: talentpulse-status
description: Số liệu kinh doanh nhanh của TalentPulse — tổng user, job active theo nguồn, alert 7 ngày. Dùng khi user hỏi thống kê chung.
---

# TalentPulse Status

Trả lời nhanh các câu hỏi thống kê thường gặp.

## Cách dùng

1. Chạy: `bash scripts/status.sh` (từ thư mục skill này)
2. Tóm tắt tiếng Việt, gọn theo từng nhóm (user/job/alert).
3. Nếu user hỏi chi tiết hơn mức này → chuyển sang skill `db-query` để viết câu SELECT riêng.

## Quy tắc

- CHỈ ĐỌC. Không đổi dữ liệu.
- Nếu query lỗi (kể cả do DB_URL sai), báo nguyên văn, gợi ý kiểm tra biến `TP_DB_URL`.
```

- [ ] **Step 3: Test trên box**

Trên box chạy `bash ops/openclaw/install-skills.sh`, rồi nhắn Slack:
`"báo cáo nhanh: user, job, alert?"`

Expected: bot chạy `status.sh`, trả lời 3 nhóm số liệu tiếng Việt.

- [ ] **Step 4: Commit**

```bash
git add ops/openclaw/skills/talentpulse-status/
git commit -m "ops: openclaw talentpulse-status skill"
```

---

### Task 6: Cảnh báo chủ động — automation cron 15 phút

**Files:**
- Create: `ops/openclaw/scripts/check_alerts.sh` (script kiểm tra, chỉ in khi có vấn đề)

**Interfaces:**
- Consumes: channel ID `C...` của `#server-alerts` từ Task 1; `TP_DB_URL`.
- Produces: automation `talentpulse-alerts` chạy mỗi 15 phút trên box, announce vào `#server-alerts` khi phát hiện vấn đề.

- [ ] **Step 1: Viết `check_alerts.sh`**

Tạo `ops/openclaw/scripts/check_alerts.sh`:

```bash
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
```

- [ ] **Step 2: Test script trên box (thủ công, trước khi đặt lịch)**

```bash
bash ops/openclaw/scripts/check_alerts.sh
```

Expected: in `NO_REPLY` (nếu hệ thống khỏe) hoặc các dòng cảnh báo. Chạy 2 lần — kết quả phải giống nhau (deterministic).

- [ ] **Step 3: Tạo automation trên box**

```bash
openclaw automations create "*/15 * * * *" \
  --name "talentpulse-alerts" \
  --command "bash /ops/openclaw/scripts/check_alerts.sh" \
  --announce \
  --channel slack \
  --to "channel:C0123456789" \
  --timeout-seconds 120
```

(Thay `C0123456789` bằng ID thật của `#server-alerts`.)

- [ ] **Step 4: Verify automation đã lưu + chạy thử**

```bash
openclaw automations list
openclaw automations run talentpulse-alerts --wait --wait-timeout 2m
openclaw automations runs --id talentpulse-alerts --limit 5
```

Expected: job `talentpulse-alerts` trong list; run trả `ok`; nếu có vấn đề thật thì tin nhắn xuất hiện trong `#server-alerts`, nếu khỏe thì im lặng.

- [ ] **Step 5: Commit**

```bash
git add ops/openclaw/scripts/check_alerts.sh
git commit -m "ops: openclaw alert-cron check script"
```

---

### Task 7: Tài liệu tổng + hoàn thiện

**Files:**
- Create: `ops/openclaw/README.md`

- [ ] **Step 1: Viết `README.md`**

Tạo `ops/openclaw/README.md`:

```markdown
# OpenClaw Ops — quản lý web box qua Slack

OpenClaw (gateway trên web box) + Slack = hỏi mọi thứ về server và số liệu, nhận cảnh báo chủ động.

## Cách hỏi (trong Slack, DM bot hoặc mention trong kênh)

| Bạn hỏi | OpenClaw dùng |
|---|---|
| "sức khỏe server?" | skill `server-health` |
| "đếm job fresher HCM?" | skill `db-query` (tự viết SQL) |
| "báo cáo nhanh user/job/alert?" | skill `talentpulse-status` |
| (tự động mỗi 15 phút) | automation `talentpulse-alerts` → #server-alerts |

## Files

- `slack-manifest.json` — manifest Slack App (dán vào api.slack.com)
- `SLACK_SETUP.md` — hướng dẫn tạo app + token
- `slack.socket.patch.json5` — config patch channel Slack
- `scripts/db_query.py` — wrapper SQL đọc-only (chặn non-SELECT, có pytest)
- `scripts/health.sh`, `scripts/status.sh`, `scripts/check_alerts.sh` — script các skill
- `skills/*/SKILL.md` — định nghĩa skill
- `install-skills.sh` — copy skills lên `~/.openclaw/skills/`

## Bảo trì

- Sửa skill → `bash install-skills.sh` trên box → hỏi lại qua Slack để test.
- Sửa cảnh báo → sửa `check_alerts.sh` → chạy thử tay → (không cần đụng automation).
- Xem lịch chạy: `openclaw automations list`
```

- [ ] **Step 2: Chạy test lần cuối (repo)**

```bash
apps\backend\.venv\Scripts\python.exe -m pytest ops/openclaw/tests -q
```

Expected: `7 passed`.

- [ ] **Step 3: Verify tổng trên box**

```bash
openclaw automations list          # thấy talentpulse-alerts
ls ~/.openclaw/skills/             # thấy server-health, db-query, talentpulse-status
```

Nhắn Slack: `"sức khỏe server?"` → trả lời tiếng Việt có số liệu.

- [ ] **Step 4: Commit**

```bash
git add ops/openclaw/README.md
git commit -m "ops: openclaw README + final docs"
```

---

## Self-Review (checklist đã chạy)

- **Spec coverage**: Slack kết nối → Task 1-2 ✓; server-health → Task 3 ✓; db-query → Task 4 ✓; talentpulse-status → Task 5 ✓; alert-cron → Task 6 ✓; tài liệu → Task 7 ✓. Allowlist Slack → Task 2 (`dmPolicy: allowlist` + `groupPolicy: allowlist`) ✓. Mức Xem + Cảnh báo (không tự sửa) → mọi skill CHỈ ĐỌC, không có lệnh restart/rm trong skill; script cảnh báo chỉ in, không sửa ✓.
- **Placeholder scan**: không có TBD/TODO; channel ID `C0123456789` là placeholder có chú thích thay bằng ID thật (bắt buộc trong task).
- **Type consistency**: `validate_sql`/`db_query.py`/`TP_DB_URL` dùng nhất quán qua Task 4-6; skill name `talentpulse-alerts` khớp giữa Task 6 và 7.
