# Admin Traffic & Investor Metrics — Design Spec

**Ngày:** 2026-08-02 · **Trạng thái:** đã duyệt (chờ implementation plan) · **Phạm vi repo:** `apps/backend`, `apps/frontend`, `deploy/`, `docker-compose.yml`, hạ tầng DNS

---

## 1. Bối cảnh & mục tiêu

Cần bộ chỉ số chứng minh cho nhà đầu tư rằng người dùng thật sự truy cập và sử dụng TalentPulse. Hiện tại **không có bất kỳ hệ thống đo lường nào**: không analytics client-side, không request logging server-side, và access log của nginx bị xoá mỗi lần deploy.

**Mục tiêu:** một trang `/admin/analytics` trả lời được bốn câu hỏi, với số liệu đủ tin cậy để đưa vào pitch deck:

1. Có bao nhiêu người vào web, đến từ đâu, tăng trưởng ra sao?
2. Họ có quay lại không?
3. Bao nhiêu phần trăm khách vãng lai trở thành user thật sự dùng sản phẩm?
4. User làm được gì trong sản phẩm?

**Mốc thời gian:** 3 tháng trở lên — đủ để xây nền tảng bài bản thay vì chắp vá.

---

## 2. Quyết định đã chốt (với user)

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **Cả 4 nhóm chỉ số**: traffic+tăng trưởng, retention, funnel, chiều sâu sử dụng | Nhà đầu tư hỏi cả bốn |
| 2 | **Hybrid privacy**: khách vãng lai ẩn danh không cookie; user đã đăng nhập gắn `user_id` (UUID, pseudonymous) | Đủ để tính retention/funnel mà không đẩy PII sang tầng analytics |
| 3 | **Tự host thêm 1 container** thay vì SaaS hoặc tự viết toàn bộ | Kiểm soát dữ liệu, không phí hàng tháng, không phải tự vẽ toàn bộ UI phân tích |
| 4 | **Umami** (không phải Plausible CE / PostHog CE) | Xem §2.1 |
| 5 | **Đưa domain qua Cloudflare ngay** từ đầu | Có số liệu đo ở tầng edge song song với Umami ngay từ ngày đầu thu thập |
| 6 | Tận dụng `BarChart`/`DonutChart` đã có trong admin dashboard | Không thêm thư viện biểu đồ mới |

### 2.1 Vì sao Umami, không phải lựa chọn khác

| Ứng viên | Đánh giá |
|---|---|
| **Umami v2** ✅ | Một container Node (~150-200MB RAM), **dùng chung Postgres** đang chạy. Cookieless mặc định. Từ v2.9 có sẵn Funnel / Retention / Goals / UTM — phủ đúng 4 nhóm chỉ số. Có `identify()` gắn `user_id`. Có REST API để kéo số về `/admin`. |
| Plausible CE ❌ | Cần **ClickHouse + Postgres riêng** → 2-3 container, ~1-2GB RAM trên box đã chạy 8 service. Chỉ đo tổng hợp — retention theo cohort của user đăng ký vẫn phải tự viết SQL. Trả giá hạ tầng cao hơn mà không giảm được phần việc tự làm. |
| PostHog CE ❌ | Yêu cầu ClickHouse + Kafka + Zookeeper + Redis, tối thiểu ~4GB RAM. Chính PostHog đã ngừng khuyến nghị self-host cho nhóm nhỏ. |

---

## 3. Hiện trạng (khảo sát 2026-08-02)

### 3.1 Admin dashboard đang có

5 trang dưới `apps/frontend/app/admin/` (overview, users, jobs, alerts, config), tất cả là client component gọi `apps/backend/app/api/admin.py` → `app/services/admin.py` (raw SQL).

- **Overview** (`app/admin/page.tsx:53-150`): 12 KPI card + BarChart signups/alerts 30 ngày + DonutChart tier/channel.
- Nguồn dữ liệu tách đôi: `app.*` (users, alert_logs, telegram_connections, interview_*, chat_*) cho chỉ số người dùng; `dbt_dev_gold.fct_jobs_daily` + `dbt_dev_silver.*` cho job.
- **Toàn bộ là đếm bản ghi tĩnh** — không có chỉ số theo thời gian ngoài biểu đồ 30 ngày phẳng, không có tăng trưởng, retention, funnel, hay traffic.

### 3.2 Telemetry hiện có

**Không có gì.** Không GA/Plausible/PostHog/Umami/Vercel Analytics/Sentry trong `package.json`, `app/layout.tsx`, `next.config.js`. Backend `app/main.py` chỉ đăng ký `CORSMiddleware` — không có request logging middleware. Telemetry duy nhất tìm thấy là của `@copilotkit/runtime` và **đã bị tắt** (`COPILOTKIT_TELEMETRY_DISABLED=true`).

### 3.3 Hai lỗ hổng nền chặn đường

| # | Vấn đề | Vị trí | Hệ quả |
|---|---|---|---|
| G1 | `User` **không có** `last_login`/`last_active` | `app/models/user.py` | DAU/WAU/MAU **không tính được** từ dữ liệu hiện có |
| G2 | nginx access log **không mount ra host** | `docker-compose.yml:214-239`, `deploy/nginx/nginx.conf:40-41` | Log nằm trong writable layer của container, **mất sạch mỗi lần deploy** |

### 3.4 Topology edge

- nginx reverse proxy trước Next.js (`:8002`) và FastAPI (`:8001`); frontend gọi `/api/...` same-origin nên **mọi traffic API của trình duyệt đều đi qua nginx**.
- **Cloudflare CHƯA được dùng.** Kiểm chứng ngày 2026-08-02: `talentpuse.io.vn` → `103.75.181.109` (không thuộc dải Cloudflare), response header `Server: nginx/1.27.5`, **không có `CF-Ray`**. Comment "TLS terminates at Cloudflare" ở `deploy/nginx/nginx.conf:8-10` là **sai/lỗi thời**.
- Tailscale chỉ dùng cho kết nối DB nội bộ giữa web box và warehouse box, không liên quan ingress công khai.
- `apps/backend/docs/deploy.md` mô tả một topology khác (Caddy, docker-compose.prod.yml) **không khớp thực tế** — không dùng file này để suy luận.

---

## 4. Kiến trúc & luồng dữ liệu

Ba nguồn đo, mỗi nguồn trả lời một câu hỏi khác nhau, **cố ý chồng lấn ở phần traffic** để đối chiếu lẫn nhau.

```
Trình duyệt khách
      │
      ▼
┌─────────────────────┐   ① Cloudflare edge (server-side)
│     Cloudflare      │──► requests / unique visitors / quốc gia / bot
│   (proxy: ON)       │      adblock KHÔNG chặn được → con số "khách quan"
└──────────┬──────────┘      lấy qua GraphQL Analytics API
           │ TLS
           ▼
┌─────────────────────┐   ② nginx access log (JSON, mount ra host)
│  nginx (web box)    │──► bản ghi thô, đối chiếu khi ① và ③ lệch
└─────┬───────────┬───┘
      │           │
      ▼           ▼
 Next.js      FastAPI
      │           │
      │ ③ /s/script.js (first-party, cùng domain)
      ▼           │
┌─────────────────────┐   ③ Umami (container mới)
│      Umami          │──► pageview, nguồn/UTM, funnel, retention,
│ (Postgres: db riêng)│     goals. identify(user_id) sau đăng nhập
└─────────────────────┘
           ▲
           │ REST API (server-side, token không lộ ra browser)
┌──────────┴──────────┐   ④ Postgres app.* + dbt warehouse
│  /admin/analytics   │──► chiều sâu sản phẩm: alert đã gửi, chat AI,
│   (ghép ①+③+④)     │     phỏng vấn thử, ứng tuyển, DAU/WAU/MAU
└─────────────────────┘
```

### 4.1 Bốn quyết định kiến trúc

**(a) Umami dùng chung *instance* Postgres nhưng database riêng (`umami`).** Không thêm DB container, nhưng dữ liệu analytics không đụng schema `app.*` — backup, migration và quyền truy cập tách bạch. Đánh đổi phải chấp nhận: Umami ghi khá nhiều và dùng chung I/O với DB nghiệp vụ. Ở quy mô hiện tại chưa đáng lo, nhưng **bắt buộc** giới hạn pool riêng (§7).

**(b) Tracker script phục vụ first-party.** Không nhúng từ subdomain riêng (adblock chặn theo domain). Thêm `location /s/script.js` và `location /s/api/send` trong nginx proxy về `umami:3000`. Đường dẫn cố ý trung tính — **không** chứa chuỗi `umami`/`analytics`/`track` vì các bộ lọc adblock khớp cả path. Đây là khác biệt giữa "số liệu dùng được" và "số liệu hụt 30-40%".

**(c) Chỉ gửi `user_id` (UUID) sang Umami, không gửi email/tên.** Khách vãng lai hoàn toàn ẩn danh; user đăng nhập được gắn định danh giả đủ để nối funnel và tính retention.

**(d) `/admin` gọi Umami/Cloudflare API qua backend, không gọi thẳng từ browser.** Token nằm ở server. Kết quả cache 5-15 phút để trang admin không bắn API mỗi lần render.

---

## 5. Thành phần chi tiết

### 5.1 Container Umami

Thêm service vào `docker-compose.yml` (sau `redis`):

- Image `ghcr.io/umami-software/umami:postgresql-latest`.
- `DATABASE_URL` trỏ Postgres đang chạy, **database `umami` riêng**, user riêng chỉ có quyền trên DB đó — lỗi ở Umami không đụng được `app.*`.
- `APP_SECRET` lấy từ env, **không hardcode**.
- Không expose port ra ngoài; chỉ nói chuyện với nginx qua network nội bộ.
- Umami tự chạy migration lúc khởi động.
- Bước provisioning một lần: `CREATE DATABASE umami` + `CREATE USER umami_app` + grant.

### 5.2 nginx: hai location mới

`/s/script.js` và `/s/api/send` → `proxy_pass http://umami:3000/script.js` và `/api/send`. Giữ `X-Forwarded-For` để Umami thấy IP thật (sau Cloudflare là `CF-Connecting-IP`).

### 5.3 Frontend: nhúng tracker + identify

- Script vào root layout (`apps/frontend/app/layout.tsx`) để chạy trên mọi route, thuộc tính `async` + `defer`.
- Gọi `identify(user_id)` tại nơi đã biết trạng thái đăng nhập (`AuthContext`), **chỉ truyền UUID**.
- Người chưa đăng nhập không gọi gì thêm.

### 5.4 Cột `last_active_at` + cơ chế cập nhật rẻ

- Alembic migration: thêm `last_active_at timestamptz` + index vào `app.users`.
- **Quy ước timezone bắt buộc**: luôn `datetime.now(timezone.utc)`, không `utcnow()` naive — repo đã dính lỗi này (xem `docs/superpowers/bugs/2026-08-02-job-alert-audit.md`, JA-T1).
- Cập nhật **không phải mỗi request**: dùng Redis (đã có trong compose) làm bộ chặn — `SET active:{user_id}:{giờ} NX EX 3600`, chỉ khi set thành công mới `UPDATE`. Tối đa 1 lần ghi/user/giờ.

### 5.5 View `user_activity_daily` (dựng lại lịch sử)

`last_active_at` chỉ có dữ liệu từ ngày triển khai. Nhưng lịch sử **dựng lại được** bằng một view gộp timestamp từ các bảng đã có (tên bảng đã đối chiếu với `app/models/`): `app.chat_messages`, `app.chat_rooms`, `app.interview_sessions`, `app.interview_answers`, `app.interview_messages`, `app.job_applications`, `app.cv_documents`, `app.alert_logs`. Định nghĩa: *"user X có hoạt động ngày Y"* = tồn tại bất kỳ bản ghi nào của X trong ngày Y (theo ngày VN).

Lưu ý khi hiện thực: `app.alert_logs` là hoạt động **hệ thống gửi cho user**, không phải user chủ động — nên đưa vào một cột riêng (`was_alerted`) chứ không gộp vào `was_active`, nếu không retention sẽ bị thổi phồng bởi chính alert của mình.

Nhờ vậy có ngay đường cong retention **lùi về ngày đầu tiên** thay vì phải chờ 3 tháng. Đây là lý do lớn nhất khiến hướng tự-host-cạnh-DB thắng hướng SaaS.

### 5.6 nginx JSON access log

- `log_format json_combined escape=json` gồm: `time_iso8601`, `remote_addr` (hoặc `CF-Connecting-IP`), `request_uri`, `status`, `body_bytes_sent`, `http_referer`, `http_user_agent`, `request_time`, `upstream_status`.
- `volumes: - ./logs/nginx:/var/log/nginx` trong `docker-compose.yml`.
- `logrotate` giữ 30 ngày.

### 5.7 Cloudflare

- Đưa nameserver về Cloudflare, bật proxy (mây cam) cho `talentpuse.io.vn`.
- SSL mode **Full (strict)** + Origin Certificate cài trên nginx; bật "Always Use HTTPS".
- **Không** nhúng beacon Web Analytics của CF (Umami đã lo client-side). Thứ lấy từ CF là **số liệu tầng edge** qua GraphQL Analytics API (`httpRequests1dGroups`).
- Hạ TTL DNS xuống 300s **trước** khi đổi; xác minh bằng `/etc/hosts` trước khi cho traffic thật đi qua.

### 5.8 Module analytics ở backend

Cố ý **không** nhồi vào `admin.py` (~400 dòng) / `services/admin.py` (541 dòng) — thêm nữa là vượt ngưỡng dễ đọc và dễ sửa.

```
app/services/analytics/
  umami_client.py       chỉ biết gọi REST Umami, trả dataclass
  cloudflare_client.py  chỉ biết gọi GraphQL CF, trả dataclass
  product_metrics.py    SQL trên app.* + warehouse (DAU/WAU/MAU, funnel, chiều sâu)
  cache.py              cache Redis 5-15 phút, key theo (nguồn, khoảng ngày)
app/api/analytics.py    router mỏng, chỉ ghép và trả về; require_admin
```

Mỗi file một nhiệm vụ, test được độc lập: hai client mock bằng HTTP giả, `product_metrics` test bằng DB thật, router test bằng mock service.

### 5.9 Trang `/admin/analytics`

Trang mới ở frontend — không nhồi thêm vào `app/admin/page.tsx` (đã 12 KPI card + 4 biểu đồ). Dùng lại `BarChart`/`DonutChart` đã có.

### 5.10 Link chuyển hướng đo CTR alert

`talentpuse.io.vn/r/{alert_log_id}` → ghi nhận click rồi redirect tới `source_url` thật, thay cho việc gắn thẳng link nguồn vào tin Telegram/email.

**Phối hợp bắt buộc:** việc này đụng đúng bảng `alert_logs` mà audit đang đề xuất thêm cột `source` (JA-05). **Gộp chung một migration**, không đổi schema hai lần.

---

## 6. Chỉ số hiển thị

### 6.1 Traffic & tăng trưởng

| Chỉ số | Nguồn chuẩn | Đối chiếu |
|---|---|---|
| Unique visitors / tháng | Cloudflare | Umami, nginx log |
| Pageviews, sessions, trang/phiên | Umami | — |
| **Tăng trưởng WoW / MoM (%)** | Tính từ trên | — |
| Nguồn traffic: direct/search/referral/social + UTM | Umami | — |
| Landing page phổ biến nhất | Umami | nginx log |
| Quốc gia/tỉnh, thiết bị | Cloudflare | Umami |

### 6.2 Retention

| Chỉ số | Nguồn |
|---|---|
| DAU / WAU / MAU (user đăng ký) | `last_active_at` + `user_activity_daily` |
| **Stickiness = DAU/MAU** | Tính |
| Cohort retention D1/D7/D30 theo tuần đăng ký | `users.created_at` + `user_activity_daily` |
| Tỉ lệ quay lại sau alert đầu tiên | `alert_logs` + `user_activity_daily` |
| Churn: % user im lặng >30 ngày | `last_active_at` |

### 6.3 Funnel

```
Khách vào web ──► xem /jobs ──► đăng ký ──► hoàn thiện hồ sơ ──► bật kênh alert ──► nhận alert đầu ──► click job
   (Umami)        (Umami)     (nối tại đây)  (skills/titles)   (telegram/email)   (alert_logs)    (§5.10)
```

Ba con số chốt: **signup conversion** (% khách thành user) · **activation rate** (% user bật được alert) · **time-to-activation** (thời gian từ đăng ký tới alert đầu tiên). Hai nửa funnel nối bằng `identify(user_id)` gọi đúng lúc đăng ký thành công.

### 6.4 Chiều sâu sử dụng

Phần lớn đã có trong `app.*`: alert đã gửi theo kênh, số job distinct đã alert, phiên/tin nhắn chat AI, phiên/câu trả lời phỏng vấn thử, ứng tuyển được theo dõi, số job trong kho.

**Bổ sung mới quan trọng nhất: CTR của alert** (§5.10). Nói được *"alert của chúng tôi đạt X% CTR"* mạnh hơn nhiều so với *"chúng tôi đã gửi 10.000 alert"*.

### 6.5 Trung thực về sai số

Ba nguồn **sẽ lệch nhau 10-30%** (adblock, cách lọc bot khác nhau). Quy ước đã chốt: **Cloudflare là chuẩn cho traffic, Postgres là chuẩn cho user**, và dashboard **ghi rõ mỗi con số đến từ nguồn nào**. Trước nhà đầu tư, nói được "số này đo ở tầng edge, không phụ thuộc script trình duyệt" là điểm cộng về độ tin cậy.

---

## 7. Xử lý lỗi

**Nguyên tắc bao trùm: UI phải phân biệt ba trạng thái — có dữ liệu / thật sự bằng 0 / nguồn lỗi.** Repo đang mắc đúng lỗi này (JA-33): fetch hỏng bị nuốt và render thành empty state, người xem hiểu nhầm thành "không có gì".

| Tình huống | Xử lý |
|---|---|
| Umami/CF API chậm hoặc chết | Timeout 5s + trả cache cũ kèm nhãn "số liệu lúc HH:MM"; **không** trả số 0 |
| Mỗi thẻ số khi nguồn lỗi | Hiện "Không lấy được từ \<nguồn\>" + nút thử lại |
| Umami container chết | Script `async`, lỗi im lặng; `/s/*` khi upstream chết thì nginx trả **204**, không 502 |
| Redis chết | Bỏ throttle, rơi về `UPDATE ... WHERE last_active_at < now() - interval '1 hour'` |
| Postgres dùng chung | Umami **phải** có pool riêng giới hạn nhỏ. Backend đang `pool_size=5, max_overflow=0` (JA-15) — thêm consumer ghi nhiều mà không giới hạn sẽ làm web chết vì `QueuePool limit reached` |
| Cloudflare cutover hỏng | TTL 300s đặt trước; rollback = trỏ DNS về IP cũ |

---

## 8. Testing

| Loại | Nội dung |
|---|---|
| Unit | `umami_client` / `cloudflare_client` với `httpx.MockTransport`, **bắt buộc có ca 429/500/timeout** — không lặp lại lỗi nuốt exception ở JA-03 |
| Integration (DB thật) | `product_metrics`: seed user + hoạt động, assert DAU/WAU/MAU và cohort **ở đúng biên ngày** |
| Timezone | **Một test bắt buộc**: ranh giới ngày nhất quán `Asia/Ho_Chi_Minh` ở mọi truy vấn. Repo đã dính lỗi này ba lần (JA-25, JA-T1, JA-T2) |
| Authz | 403 cho user thường trên **mọi** endpoint `/api/admin/analytics/*` |
| Frontend | Lỗi fetch render ra panel lỗi, **không** phải empty state |
| E2E nhẹ | Tải trang có phát request tới `/s/api/send` |

---

## 9. Thứ tự triển khai

Mỗi bước độc lập và tự nó có giá trị; dừng giữa chừng không để lại trạng thái hỏng.

| # | Bước | Giá trị đạt được ngay | Phụ thuộc |
|---|---|---|---|
| 1 | Migration `last_active_at` + Redis throttle + view `user_activity_daily` | **DAU/WAU/MAU + retention có lịch sử lùi về ngày đầu** | — |
| 2 | nginx JSON log + mount volume + logrotate | Bắt đầu tích luỹ bằng chứng server-side | — |
| 3 | Umami container + `/s/*` first-party + nhúng script + `identify` | Traffic, nguồn, funnel nửa đầu | — |
| 4 | Cloudflare cutover | Số liệu edge khách quan + CDN/WAF | §11-R1 |
| 5 | Module analytics backend + trang `/admin/analytics` | Ghép ba nguồn thành một trang | 1, 3, 4 |
| 6 | Link `/r/{alert_log_id}` đo CTR alert | Chỉ số mạnh nhất cho pitch | Gộp migration với JA-05 |

---

## 10. Cố ý nằm ngoài phạm vi (YAGNI)

Session replay · A/B testing · doanh thu/MRR (chưa có thanh toán) · attribution đa chạm · data warehouse riêng cho analytics · realtime dashboard. Thêm bất kỳ thứ nào lúc này chỉ làm chậm bước 1-3 vốn mang lại toàn bộ giá trị.

---

## 11. Rủi ro & điểm phải xác minh trước khi làm

| ID | Nội dung | Vì sao quan trọng |
|---|---|---|
| **R1** | **Xác định tầng TLS thật.** Site trả HTTPS với `Server: nginx/1.27.5` nhưng nginx trong `docker-compose.yml` chỉ listen `:80` → có một tầng TLS nữa mà repo không mô tả (nginx cấp host, hoặc config prod khác) | Quyết định chọn SSL mode `Full (strict)` hay `Flexible`. Chọn sai → hoặc lỗi vòng lặp redirect, hoặc chạy HTTP trần giữa CF và origin |
| R2 | Umami ghi chung instance Postgres | Theo dõi I/O sau khi bật; nếu ảnh hưởng DB nghiệp vụ thì tách instance riêng |
| R3 | Adblock vẫn có thể chặn `/s/*` nếu bị đưa vào danh sách lọc | Chính là lý do giữ cả ba nguồn; CF và nginx log không bị ảnh hưởng |
| R4 | Bot/crawler làm phồng số liệu | CF lọc bot tốt; nginx log **không** lọc → phải lọc theo User-Agent khi phân tích |
| R5 | Sửa `deploy/nginx/nginx.conf:8-10` (comment sai về Cloudflare) và `apps/backend/docs/deploy.md` (topology sai) | Tránh người sau đọc nhầm hạ tầng |

---

## 12. Tiêu chí thành công

1. `/admin/analytics` hiển thị đủ 4 nhóm chỉ số, mỗi con số **ghi rõ nguồn**.
2. Retention có dữ liệu **lùi về ngày user đầu tiên đăng ký**, không phải chỉ từ ngày triển khai.
3. Ba nguồn traffic hiển thị cạnh nhau; chênh lệch giữa chúng nhìn thấy được thay vì bị giấu.
4. Nguồn ngoài chết → dashboard nói rõ "không lấy được", không hiển thị 0.
5. Không endpoint analytics nào truy cập được bởi user không phải admin.
6. Bật analytics **không** làm chậm trang web cho người dùng cuối.
