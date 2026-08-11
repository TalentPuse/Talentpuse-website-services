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
- `scripts/check_alerts.sh` — script chạy bởi automation `talentpulse-alerts`
- `skills/server-health/scripts/health.sh` — script skill `server-health`
- `skills/talentpulse-status/scripts/status.sh` — script skill `talentpulse-status`
- `skills/*/SKILL.md` — định nghĩa skill
- `install-skills.sh` — copy skills lên `~/.openclaw/skills/`

> **Lưu ý đường dẫn:** web box phải checkout repo tại `/ops/openclaw` — các script
> (`status.sh`, `check_alerts.sh`), SKILL.md và automation đều dùng đường dẫn
> tuyệt đối bắt đầu bằng `/ops/openclaw/`.

## Bảo trì

- Sửa skill → `bash install-skills.sh` trên box → hỏi lại qua Slack để test.
- Sửa cảnh báo → sửa `check_alerts.sh` → chạy thử tay → (không cần đụng automation).
- Xem lịch chạy: `openclaw automations list`
