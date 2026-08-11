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
