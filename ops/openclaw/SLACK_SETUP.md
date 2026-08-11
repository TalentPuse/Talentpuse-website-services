# Kết nối OpenClaw với Slack

1. Vào https://api.slack.com/apps/new → **Create New App** → **From a manifest**
2. Chọn workspace của bạn → paste toàn bộ nội dung `slack-manifest.json` → Next → Create
3. Trong trang app mới tạo:
   - **Basic Information → App-Level Tokens → Generate Token and Scopes**:
     - Scope: `connections:write`
     - Copy token dạng `xapp-...` → đây là SLACK_APP_TOKEN
   - **Install App → Install to Workspace → Allow**:
     - Copy **Bot User OAuth Token** dạng `xoxb-...` → đây là SLACK_BOT_TOKEN
4. Tạo kênh `#server-alerts` trong Slack (nếu chưa có) và mời bot OpenClaw vào kênh.
5. Lấy channel ID của `#server-alerts`: click chuột phải kênh → **Copy link** →
   ID dạng `C12345678` nằm ở cuối URL. Ghi lại — Task 6 cần.
6. Gửi 2 token + channel ID cho agent (paste vào chat) để cấu hình ở Task 2.