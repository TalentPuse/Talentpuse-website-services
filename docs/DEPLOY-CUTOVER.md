# Cutover: đưa app sang DB riêng trên web box

> Trình tự cho **một lần** deploy. Sau lần này thì deploy bình thường như cũ.
> Kiến trúc: `docs/architect.md` · Lý do tách: `pipeline_data/docs/website-warehouse-db-split.md`

## Mô hình sau cutover

```
WEB BOX                                  WAREHOUSE BOX
  nginx :80  ──► frontend :8002
             └─► backend  :8001
  redis
  tp-postgres  (DB `talentpulse`)         postgres :5432
    app, user_alerts, public   (ghi)  ◄── sync 1 chiều, 15:00 ── dbt_dev_*
    dbt_dev_*                  (đọc)      (nguồn thật)
```

Backend chỉ nói chuyện với **một** database — `tp-postgres`. Nó JOIN `app.job_applications`
với `dbt_dev_gold.fct_jobs_daily` trong cùng câu SQL, mà Postgres không join xuyên
database, nên bản sao `dbt_dev_*` trên web box là **bắt buộc**, không phải tối ưu.

## ⚠️ Thứ tự quan trọng

Sync **phải chạy trước** khi đổi `DATABASE_URL`. Đổi trước thì backend trỏ vào DB chưa
có bảng job → trang Việc làm trống trơn.

---

## 1. Secrets cần thêm (GitHub → Settings → Secrets)

| Secret | Ở repo | Giá trị |
|---|---|---|
| `APP_POSTGRES_PASSWORD` | `talentpulse` | `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `DATABASE_URL` | `talentpulse` | `postgresql://talentpulse:<mật-khẩu-trên>@tp-postgres:5432/talentpulse` |
| `WEB_DATABASE_URL` | `pipeline_data` | `postgresql://talentpulse:<mật-khẩu-trên>@<WEB_TAILNET_IP>:5432/talentpulse` |

`MCP_DATABASE_URL` **giữ nguyên** trỏ kho — MCP chỉ đọc dữ liệu phân tích.

⚠️ Mặc định trong compose là `change-me-before-migration`. Nó chỉ an toàn khi DB còn
rỗng. Đặt secret thật **trước** bước 3.

⚠️ `tp-postgres` hiện không publish cổng ra host. Để box warehouse sync sang được, web
box phải mở đường — publish `127.0.0.1:5432` rồi `tailscale serve --bg --tcp=5432
tcp://127.0.0.1:5432`, giống cách box warehouse đang mở.

## 2. Bật hạ tầng trên web box

```bash
docker compose up -d --no-build nginx     # kéo theo frontend + backend + redis + postgres
```

`infra.yml` tự chạy khi push chạm `docker-compose.yml` hoặc `deploy/`.

Kiểm bằng `docker compose ps`: `tp-nginx`, `tp-redis`, `tp-postgres` phải `healthy`.

## 3. Chạy sync lần đầu — THỦ CÔNG

Trên box warehouse:

```bash
WEB_DATABASE_URL="postgresql://talentpulse:<pass>@<WEB_TAILNET_IP>:5432/talentpulse" \
  python -m orchestration.flows.sync_to_web
```

Bảy đối tượng được chuyển:

```
dbt_dev_gold.fct_jobs_daily
dbt_dev_gold.mart_company_hiring
dbt_dev_gold.mart_salary_by_level
dbt_dev_gold.mart_skill_demand
dbt_dev_feature.job_features
dbt_dev_silver.silver_job_detail      ← VIEW, được vật chất hoá thành bảng
dbt_dev_silver.silver_skill_long      ← xem ghi chú dưới
```

**Đọc kỹ artifact trước khi sang bước 4.** Flow cố ý **không** chết khi một đối tượng
thiếu — nó ghi `**THIẾU Ở KHO: ...**` rồi sync tiếp phần còn lại. Nếu `fct_jobs_daily`
ra 0 dòng thì **dừng lại**, đừng đổi `DATABASE_URL`.

> `silver_skill_long` hiện **chưa được dbt build** (đã kiểm cả kho local lẫn production).
> Thiếu nó thì `/jobs` vẫn chạy nhưng job **không có tag kỹ năng**, và chấm điểm khớp
> job theo skill kém hẳn. Chạy dbt cho model này trước nếu muốn đủ tính năng.

## 4. Đổi `DATABASE_URL` sang DB mới

Cập nhật secret rồi deploy lại backend. Lúc khởi động, `alembic upgrade head` sẽ tạo
`app`, `user_alerts`, `public` trên DB rỗng.

**Không cần di trú dữ liệu.** Đã kiểm ngày 2026-07-26 trên kho production: không có
schema `app`, không có `alembic_version`, `public` rỗng — backend chưa từng chạy với
kho đó. Không có dữ liệu người dùng nào để mang sang.

## 5. Kiểm sau cutover

| Kiểm | Kỳ vọng |
|---|---|
| `POST /api/auth/signup` | tạo được tài khoản (chứng minh alembic đã dựng schema) |
| `/jobs` | ra danh sách job (chứng minh sync thành công) |
| `/applications` | Kanban lên, dock AI trả lời |
| `docker compose logs backend \| grep -i error` | sạch |

## 6. Gắn lịch sync

Đăng ký deployment cho flow `sync-to-web`, chạy **sau** skill-extraction (VN 15:00) để
nó công bố một kho đã hoàn chỉnh chứ không phải kho đang build dở.

## 7. Backup — làm ngay sau khi có dữ liệu thật

Từ giờ web box **giữ dữ liệu người dùng**. `docker compose down -v` trên box đó sẽ
**xoá sạch tài khoản**. Trước đây lệnh này vô hại vì web box không giữ trạng thái gì.

Cần cron `pg_dump` schema `app` + `user_alerts` + `public` → R2 hằng ngày (đã có sẵn
`S3_*` trong secrets). Kho thì tạo lại được bằng crawl lại; dữ liệu người dùng thì không.

---

## Đường lùi

Cutover chỉ là đổi một secret. Có sự cố thì trỏ `DATABASE_URL` về kho như cũ rồi deploy
lại backend — dữ liệu cũ vẫn nguyên ở đó, vì sync là **một chiều**, không bao giờ ghi ngược.
