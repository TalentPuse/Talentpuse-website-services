# Cho frontend gọi API qua nginx thay vì gọi thẳng backend

> Spec ngày 2026-07-26. Việc **B** trong ba việc còn nợ. Nhỏ, nhưng chạm đường đi của **mọi** request từ trình duyệt.

## Vấn đề

Nginx đã được thêm và định tuyến đúng (`1e146b6`, `1eb8642`), nhưng **trình duyệt không gửi gì qua nó**.

`docker-compose.yml` truyền `NEXT_PUBLIC_API_BASE: ${NEXT_PUBLIC_API_BASE:-http://localhost:8001}` làm **build arg**. Next.js **inline hoá `NEXT_PUBLIC_*` lúc build**, nên giá trị đó bị nướng cứng vào bundle JavaScript. Kết quả: mỗi lần trình duyệt gọi API, nó đi thẳng tới `localhost:8001`, bỏ qua nginx hoàn toàn.

Hệ quả: mọi thứ nginx đang lo — `client_max_body_size 10m` cho upload CV, tắt buffer cho SSE, timeout dài cho lượt LLM — **hiện không có tác dụng gì với người dùng thật**.

## Thiết kế

Đổi `NEXT_PUBLIC_API_BASE` thành **chuỗi rỗng** khi build production. Frontend khi đó gọi đường dẫn tương đối `/api/...`, cùng origin với trang, và nginx định tuyến sang backend.

Ba thứ phải xử cùng lúc, thiếu một là vỡ:

**1. Vẫn giữ cổng 8001 publish.** `docs/DEPLOY.md` có `tailscale serve --bg --tcp=8001 tcp://127.0.0.1:8001` để pipeline POST alert vào backend. Đó là consumer **không** đi qua nginx. Gỡ cổng này là cắt đường của pipeline.

**2. `API_BASE_INTERNAL` giữ nguyên** `http://tp-backend:8001`. Đây là đường server-side của Next (SSR gọi backend trong mạng compose), không liên quan trình duyệt, không đi qua nginx.

**3. `CORS_ORIGINS` giữ nguyên.** Same-origin thì trình duyệt không còn preflight, nhưng biến này vẫn cần cho các consumer khác gọi thẳng `:8001`. Xoá đi là hỏng chỗ khác.

## Rủi ro và cách phát hiện sớm

Đây là thay đổi **build-time**: sai thì không có lỗi biên dịch, chỉ là mọi lời gọi API 404 hoặc CORS lỗi khi chạy thật. Cả `tsc` lẫn Jest đều không bắt được.

Vì vậy khâu kiểm bắt buộc là browser, không phải test:

| Kiểm | Kỳ vọng |
|---|---|
| Tab Network sau khi đăng nhập | **Không** còn request nào tới `localhost:8001`; tất cả là đường dẫn tương đối |
| Chat AI ở `/assistant` và dock `/applications` | Chữ hiện **dần** (SSE không bị buffer), không đứng im rồi hiện một cục |
| Upload CV ở `/signup` | 200, không dính 413 |
| `/jobs`, `/applications`, `/alerts`, `/profile` | Tải dữ liệu bình thường |
| Console | 0 lỗi CORS |

Mục SSE quan trọng nhất: đây là lần đầu chat AI thực sự đi qua nginx, nếu `proxy_buffering off` có vấn đề thì bây giờ mới lộ.

## Ngoài phạm vi

- TLS / HTTPS ở nginx (hiện TLS kết thúc ở Cloudflare).
- Gỡ cổng 8001 khỏi compose.
- Đổi cách frontend gọi API trong môi trường dev cục bộ.
