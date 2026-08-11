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
