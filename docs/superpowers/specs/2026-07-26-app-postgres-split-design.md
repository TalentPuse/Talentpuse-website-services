# Tách Postgres riêng cho app, rời khỏi kho warehouse

> Spec ngày 2026-07-26. Việc **C** trong ba việc còn nợ. Lớn nhất, rủi ro cao nhất — chạm dữ liệu người dùng thật.

## Vấn đề

Dữ liệu vận hành của ứng dụng đang nằm **bên trong database `warehouse`**, chung chỗ với các schema phân tích `dbt_dev_*`. Backend chỉ có **một** `DATABASE_URL` → một engine phục vụ cả hai.

Ba hệ quả:

1. **Đăng nhập phụ thuộc box warehouse còn sống.** Web box phải với sang box kia qua Tailscale chỉ để xác thực một người dùng.
2. **Kho phân tích và dữ liệu người dùng chung số phận.** Một lần khôi phục hay dựng lại kho là chạm vào tài khoản thật.
3. **Không tách được quyền.** Cùng một credential đọc được cả `app.users` lẫn mart phân tích.

## Dữ liệu đang có (đếm ngày 2026-07-26)

```
users             59      (~47 là tài khoản @example.com của các bộ test → ~12 user thật)
alert_logs      1691
chat_rooms        47   ·  chat_messages       99
interview_sessions 19  ·  interview_answers   38
interview_questions 12 ·  interview_messages   8
job_applications   9   ·  cv_documents         3
telegram_connections 2 ·  alert_subscriptions  2
```

`alert_logs` không phải log vứt đi được: `job_matcher._alerted_subquery()` dùng nó để **không gửi lại job đã báo**. Mất bảng này là người dùng bị dội lại toàn bộ job cũ ngay lần chạy alert kế tiếp.

## Quyết định đã chốt

- **Vị trí:** container Postgres trong compose của repo này, chạy trên **web box**.
- **Di trú:** mang **toàn bộ** schema `app` sang, không bỏ gì.

## Kiến trúc

Backend giữ **hai** kết nối:

| Biến | Trỏ tới | Phục vụ |
|---|---|---|
| `DATABASE_URL` | Postgres app (container, cùng box) | `app.*` — user, ứng tuyển, chat, alert log |
| `WAREHOUSE_DATABASE_URL` | Kho dbt (warehouse box, qua Tailscale) | `dbt_dev_*` — job, skill, các mart |

Thêm `get_warehouse_db()` bên cạnh `get_db()` trong `app/core/database.py`, mỗi cái một engine + session factory riêng.

### Điểm mấu chốt để không hỏng nửa chừng

`WAREHOUSE_DATABASE_URL` **mặc định bằng `DATABASE_URL`** khi chưa được đặt.

Nhờ vậy hai việc tách rời được: "thêm kết nối thứ hai" và "chuyển từng module sang dùng nó". Chuyển được module nào thì module đó dùng đường mới, module chưa chuyển vẫn chạy nguyên — không có cú big-bang, và mỗi bước đều deploy được độc lập.

### 12 module đọc kho (đã quét, đây là danh sách đầy đủ)

```
app/api/admin.py           app/api/companies.py       app/api/cv.py
app/api/jobs.py            app/api/overview.py        app/api/salary.py
app/api/skills.py          app/models/analytics.py    app/services/admin.py
app/services/application_service.py   app/services/job_matcher.py
app/services/recommendations.py
```

Con số này là **12**, không phải ~8 như ước lượng ban đầu lúc brainstorm. `app/api/cv.py` và `app/services/application_service.py` là hai chỗ dễ sót nhất.

## Di trú

`pg_dump -n app` từ warehouse → restore vào DB mới.

⚠️ **`alembic_version` nằm ở schema `public`, KHÔNG phải `app`** (đã kiểm; bản hiện tại `015`). Nên `pg_dump -n app` **không** mang nó theo. Bỏ qua chi tiết này thì `alembic upgrade head` lúc container khởi động sẽ thấy database "chưa có migration nào" và chạy lại toàn bộ từ đầu **đè lên dữ liệu vừa restore**. Đây là cái bẫy làm hỏng cả cuộc di trú.

Cách xử: sau khi restore, tạo `public.alembic_version` và ghi đúng `015` (hoặc dùng `alembic stamp`), rồi mới cho backend khởi động.

Trình tự cutover:
1. Diễn tập trọn vẹn trên một bản sao trước — không làm thẳng lần đầu.
2. Dừng backend (cửa sổ ngừng ghi ngắn).
3. `pg_dump -n app` từ warehouse.
4. Restore vào Postgres mới, đặt `alembic_version` = `015`.
5. Đổi `DATABASE_URL` sang DB mới, đặt `WAREHOUSE_DATABASE_URL` trỏ kho.
6. Bật backend, đối chiếu số dòng từng bảng khớp bảng đếm ở trên.

## Backup — bắt buộc, không phải tuỳ chọn

Đặt Postgres app trên web box nghĩa là **web box từ nay giữ dữ liệu người dùng thật**, mà đó chính là máy phơi ra internet. `CLAUDE.md` đã ghi "single-VPS no backup/DR" là lỗi nghiêm trọng chưa sửa.

Đã có sẵn R2 (`S3_*` trong secrets), nên: cron `pg_dump` hằng ngày → R2, giữ 7 bản gần nhất. **Không có phần này thì việc tách DB làm rủi ro tăng chứ không giảm** — trước đây dữ liệu ít nhất còn nằm cùng chỗ với kho.

## Rủi ro phải ghi ra giấy

`docker compose down -v` trên web box sẽ **xoá sạch dữ liệu người dùng**. Trước đây lệnh đó vô hại vì web box không giữ trạng thái gì. Phải ghi cảnh báo ngay cạnh khai báo volume trong `docker-compose.yml` và trong `docs/DEPLOY.md`.

## Kiểm chứng

- Số dòng từng bảng trong DB mới **khớp chính xác** bảng đếm ở trên.
- Đăng nhập được khi **ngắt** đường tới box warehouse — chứng minh app không còn phụ thuộc nó để xác thực.
- `/jobs`, `/skills`, `/overview`, `/salary`, `/companies`, gợi ý việc làm, và trang admin vẫn đọc được kho.
- Alert không gửi lại job đã báo (chứng minh `alert_logs` sang nguyên vẹn).
- Khôi phục thử từ bản backup R2 vào một DB rỗng và đối chiếu lại số dòng.

## Ngoài phạm vi

- Tách credential theo quyền đọc/ghi cho từng schema.
- Chuyển kho warehouse sang dịch vụ quản lý.
- HA / replica cho Postgres app.
