# OpenClaw quản lý web box TalentPulse — qua Slack

Date: 2026-08-12
Status: Approved (Phương án A — OpenClaw + CLI skills thuần)
Stakeholder: project owner (Vietnamese-language product)

## Mục tiêu

OpenClaw (self-hosted AI gateway, đã cài trên web box) trở thành **người quản lý web box TalentPulse**: bạn chat với nó qua **Slack**, hỏi mọi thông tin về sức khỏe server, số liệu kinh doanh, và nhận cảnh báo chủ động. Mức quyền: **Xem + Cảnh báo + Gợi ý** — KHÔNG tự sửa gì.

## Các quyết định đã chốt với user

| Câu | Trả lời |
|---|---|
| Mức quản lý | Xem + cảnh báo + gợi ý (read-only, không tự sửa) |
| Slack | Đã có workspace, cần hướng dẫn tạo Slack App |
| LLM key | Đã có API key |
| Vị trí | OpenClaw cùng máy với TalentPulse (đọc log/trạng thái trực tiếp) |
| Loại thông tin | Sức khỏe box + số liệu kinh doanh + cảnh báo chủ động |
| Nơi nhận cảnh báo | Kênh Slack riêng `#server-alerts` |
| Phương án kiến trúc | A — OpenClaw + skills tự viết (không viết backend mới) |

## Kiến trúc

```
Slack (user chat) ──► OpenClaw Gateway (daemon trên web box)
                        │  ~/.openclaw/openclaw.json
                        ├── Slack channel plugin
                        ├── Skills:
                        │     • server-health      — sức khỏe box (df/free/docker)
                        │     • talentpulse-status — số liệu kinh doanh (psql SELECT)
                        │     • db-query           — câu hỏi tiếng Việt → SQL SELECT
                        │     • alert-cron         — cảnh báo chủ động mỗi 15 phút
                        └── Cron → gửi vào #server-alerts
```

- Gateway là tiến trình daemon duy nhất: nhận tin Slack, chọn skill, chạy script, trả lời.
- Skills là thư mục trong `~/.openclaw/skills/`, mỗi skill gồm `SKILL.md` (hướng dẫn agent) + script chạy thực tế.
- Truy cập DB qua user `metabase_ro` (chỉ SELECT) + wrapper chặn cứng non-SELECT.

## Skills chi tiết

### a) `server-health`
Trả lời khi được hỏi. Script chạy: `df -h`, `free -h`, `uptime`, `docker ps` (service nào chạy/crashed), log backend gần đây. Câu hỏi mẫu: "sức khỏe server?", "log lỗi backend?", "deploy mới nhất khi nào?"

### b) `talentpulse-status`
Query warehouse read-only qua `metabase_ro`. Số liệu: job mới theo ngày/nguồn, user mới, alert đã gửi/fail. Câu hỏi mẫu: "hôm nay có bao nhiêu job mới?", "alert đang fail nhiều không?"

### c) `db-query`
OpenClaw tự viết SQL từ câu hỏi tiếng Việt, chạy qua wrapper chỉ-cho-SELECT. Câu hỏi mẫu: "đếm job fresher ở HCM còn active?"

### d) `alert-cron`
Cron mỗi 15 phút, kiểm tra rồi nhắn vào `#server-alerts`:
- ⚠️ Disk > 85% (kèm hướng dẫn dọn)
- 🚨 Backend/nginx/postgres crash/restart liên tục
- 📉 Crawl fail (không có job mới trong X giờ)
- ✅ Deploy mới xong → xác nhận health

## An toàn

1. Mọi truy cập DB qua `metabase_ro` + wrapper script chặn cứng: chỉ nhận câu lệnh bắt đầu bằng `SELECT` — SQL injection/DROP/UPDATE đều bị chặn từ script.
2. Skills không chứa lệnh nguy hiểm (restart/rm/reboot) — chỉ đọc log/trạng thái.
3. OpenClaw chạy bằng user thường, không phải root.
4. Allowlist Slack: chỉ user được phép mới chat được.

## Thứ tự triển khai

1. **Kết nối Slack** — hướng dẫn tạo Slack App + token, cấu hình `openclaw.json`, test chat đầu tiên qua Slack.
2. **Skill `server-health`** — script + SKILL.md, test câu hỏi thật.
3. **Skill `db-query`** — user/wrapper read-only, test chặn SQL nguy hiểm.
4. **Skill `talentpulse-status`** — câu hỏi kinh doanh mẫu.
5. **Skill `alert-cron`** — cron 15 phút → #server-alerts, test.
6. **Văn bản** — spec + README ngắn cho user.

## Ngoài phạm vi

- Không cho OpenClaw tự thực hiện thay đổi (restart/deploy/rollback) — nâng cấp sau khi dùng ổn.
- Không viết backend/MCP server mới.
- Không cấu hình channel khác (Telegram/WhatsApp) ngoài Slack.
