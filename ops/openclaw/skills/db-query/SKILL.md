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
