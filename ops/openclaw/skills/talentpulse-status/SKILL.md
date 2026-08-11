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
