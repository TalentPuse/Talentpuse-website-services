# Theme trắng · Ẩn luyện phỏng vấn · Trợ lý AI làm trang đầu · Sửa bug signup CV

> Spec ngày 2026-07-25. Bốn thay đổi độc lập, gom một đợt vì cùng chạm lớp vỏ ứng dụng.

## Bối cảnh

Đã xác minh trực tiếp trên mã nguồn và trên API đang chạy (không suy đoán từ tài liệu):

- Hệ token màu **đã có sẵn cả light lẫn dark**: `app/globals.css` định nghĩa light ở `:root`, dark ở `.dark`, kèm `@custom-variant dark (&:where(.dark, .dark *))`.
- `next-themes@0.4.6`, cấu hình `attribute="class" defaultTheme="light" enableSystem={false}`. **Không có nút đổi theme** cho người dùng — chỉ `ForceTheme` gọi `setTheme`.
- `forcedTheme?: string` **có thật** trong `node_modules/next-themes/dist/*.d.ts` (2 chỗ).
- Backend prompt `skill_advisor_prompt.py` **không** nhắc gì tới luyện phỏng vấn.

---

## 1. Theme trắng toàn site

### Vấn đề

`components/theme/ForceTheme.tsx` gọi `setTheme(...)`, mà `setTheme` của next-themes **ghi vào localStorage**. Ba trang ép dark — `app/interview/page.tsx:30`, `app/signin/page.tsx:23`, `app/signup/page.tsx:41` — nên **chỉ cần ghé một trong ba là toàn bộ ứng dụng chuyển tối vĩnh viễn**, kể cả sau khi rời trang đó.

⚠️ Hệ quả quyết định thiết kế: **xoá ba dòng `ForceTheme` là chưa đủ.** Người dùng cũ vẫn còn `"dark"` trong localStorage và sẽ vẫn thấy web tối.

### Thiết kế

1. `app/providers.tsx`: thêm `forcedTheme="light"` vào `ThemeProvider`. Đây là điểm chốt duy nhất — `forcedTheme` đè lên cả giá trị đã lưu trong localStorage, nên **user cũ cũng được sửa**, không cần bước migration nào.
2. Xoá 4 lần dùng `ForceTheme` (3 dark + 1 light thừa ở `app/page.tsx:23`) và xoá `components/theme/ForceTheme.tsx`. Khi đã có `forcedTheme`, component này im lặng không còn tác dụng — để lại là một cái bẫy cho người sửa sau.
3. **Giữ nguyên** khối `.dark` trong `globals.css` và `next-themes`. Muốn bật lại dark mode sau này chỉ cần bỏ một dòng `forcedTheme`.

### Rủi ro và cách xử lý

`signin`/`signup` vốn được **thiết kế cho nền tối**, có thể có chữ nhạt / viền nhạt trên nền sáng. Sau khi sửa phải mở browser soi thật từng trang: `/`, `/signin`, `/signup`, `/assistant`, `/jobs`, `/applications`, `/alerts`, `/profile`, `/dashboard`. Chỗ nào tương phản kém thì đổi sang token ngữ nghĩa sẵn có (`text-text`, `text-text-muted`, `border-border`, `bg-surface`, `bg-surface-2`), **không** hardcode mã màu. Kiểm luôn `app/copilotkit-theme.css` xem có giả định nền tối không.

---

## 2. Ẩn tính năng luyện phỏng vấn

Ẩn lối vào và chặn route, **giữ nguyên mã nguồn** để bật lại sau.

### Mặt tiếp xúc (đã quét toàn bộ, đây là danh sách đầy đủ)

| File | Việc |
|---|---|
| `components/shell/nav-items.ts:26` | bỏ mục sidebar |
| `components/shell/CommandMenu.tsx:40` | bỏ mục ⌘K |
| `components/dashboard/DashboardSidebar.tsx:23` | bỏ mục — **sidebar thứ hai**, dễ sót |
| `components/landing/sections/Footer.tsx:47` | bỏ link ở footer landing |
| `app/interview/page.tsx` | vào thẳng URL → chuyển hướng sang `/assistant` |
| `components/copilot/BoardCopilot.tsx:325-355` | gỡ tool `start_interview_prep` |
| `components/copilot/__tests__/board-copilot.test.tsx:324-363` | gỡ khối test của tool đó |

Giữ nguyên `components/interview/*` và thân `app/interview/page.tsx` (chỉ thay bằng redirect) để khôi phục dễ.

### KHÔNG đụng tới

- Chữ "Phỏng vấn" trong `components/applications/StatusSelect.tsx` và trang `/applications` — đó là **tên cột Kanban** cho trạng thái `interviewing`, không liên quan tính năng luyện phỏng vấn.
- `components/landing/sections/CareerJourney.tsx:18` — `["Tìm việc & làm việc", "Phỏng vấn tự tin", "Nhận offer"]` là lời kể hành trình nghề nghiệp, không phải quảng cáo tính năng, và không trỏ tới `/interview`.

Hai chỗ này là bẫy sửa nhầm; ghi ra đây để người thực thi không tự ý "dọn cho sạch".

---

## 3. Trợ lý AI làm trang đầu

Đã có sẵn một nửa: `app/signin/page.tsx:39` dùng `AI_HOME ? "/assistant" : "/dashboard"`.

1. `app/signup/page.tsx` — hai chỗ `router.push("/dashboard")` (dòng 180 trong `onSubmit`, dòng 206 trong `skipAndSubmit`) đổi sang **cùng biểu thức cờ** như `signin`, để hai đường đăng nhập/đăng ký không lệch nhau.
2. `app/page.tsx` — người **đã đăng nhập** vào `/` thì chuyển sang `/assistant`. Khách chưa đăng nhập **vẫn thấy landing marketing** (đây là kênh thu hút người dùng mới, không được bỏ).
3. `components/shell/nav-items.ts` — đưa "Trợ lý AI" lên **đầu** danh sách. Giữ nguyên mục Dashboard, chỉ đổi thứ tự.

---

## 4. Bug signup CV: lỗi một lần là khoá vĩnh viễn email đó

### Chứng cứ (chạy thật trên API đang sống, không phải suy luận)

- `POST /api/auth/signup` lần 1 → `201`
- Lặp lại **cùng email** → `409 {"detail":"Email đã được đăng ký"}`
- `POST /api/cv/upload` với PDF hỏng → `400 {"detail":"Không thể đọc file PDF. File có thể bị lỗi hoặc protect."}` ⇒ **nhánh lỗi có thật, tái hiện được**

### Cơ chế

`app/signup/page.tsx:87-127`, `handleCvUpload` **tạo tài khoản trước, phân tích CV sau**:

```
102  await authApi.signup(...)   ← tài khoản đã được tạo
110  await cvApi.upload(...)     ← lỗi ở đây thì rơi vào catch
```

CV lỗi ⇒ hiện thông báo, **không đăng nhập**, nhưng tài khoản đã tồn tại. Mà cả ba đường thoát đều gọi `authApi.signup` **lần nữa** ⇒ đều nhận `409`:

| Người dùng làm gì | Hàm | Kết quả |
|---|---|---|
| Thử upload lại | `handleCvUpload:102` | 409 |
| Chuyển tab "nhập tay" rồi submit | `onSubmit:176` | 409 |
| Bấm bỏ qua | `skipAndSubmit:202` | 409 |

Tab "Upload CV" là tab **mặc định** (`page.tsx:150`) nên đây là đường đi chính. Người dùng thấy "Email đã được đăng ký" ngay sau khi vừa đăng ký lần đầu — nghe như hệ thống hỏng. Lối thoát duy nhất là tự đoán ra tài khoản *đã* tạo rồi và sang `/signin`, nhưng giao diện không hề gợi ý điều đó.

### Thiết kế sửa

Tài khoản **buộc phải** tạo trước khi upload, vì `POST /api/cv/upload` cần token. Nên không đảo thứ tự được — phải làm cho bước signup **không lặp lại**:

1. Giữ token của lần signup thành công đầu tiên trong state/ref của trang (ví dụ `createdTokenRef`). Cả ba hàm `handleCvUpload`, `onSubmit`, `skipAndSubmit` kiểm tra trước: đã có token thì **dùng lại**, không gọi `authApi.signup` nữa.
2. Khi CV lỗi: **vẫn đăng nhập người dùng vào** bằng token đã có, rồi mời họ điền tay. Họ đã có tài khoản — bỏ mặc ở màn hình lỗi là vô lý. Thông báo phải nói rõ tài khoản đã tạo xong, chỉ mỗi CV không đọc được.
3. Chặn sớm phía client, trước khi tạo tài khoản: kiểm tra **dung lượng ≤ 5MB** (UI đang hứa "tối đa 5MB" mà **không hề kiểm tra**) và **magic byte `%PDF`** thay vì chỉ tin đuôi tên file (`page.tsx:88` hiện chỉ `endsWith(".pdf")`, đổi tên `virus.exe` thành `cv.pdf` là lọt tới server).
4. Bỏ `await new Promise(r => setTimeout(r, 600))` (`page.tsx:98`) — độ trễ **giả** cho đẹp thanh tiến trình, làm mọi lần upload chậm thêm 0.6s vô ích.

### Ràng buộc

Không đổi API backend. Toàn bộ sửa nằm ở `app/signup/page.tsx` (và `lib/api.ts` nếu cần đường trả lỗi rõ hơn).

---

## Kiểm chứng

**Tự động:** `npx tsc --noEmit` exit 0 và `npm test` xanh, chạy trong `apps/frontend`. Nền hiện tại: 10 suite / 94 test. Phải gỡ khối test `start_interview_prep`; thêm test cho: thứ tự `nav-items`, redirect `/interview`, và — quan trọng nhất — **signup CV lỗi thì KHÔNG gọi `authApi.signup` lần thứ hai**.

**Thủ công (bắt buộc, vì phần lớn thay đổi là thị giác và luồng):** rebuild Docker rồi mở browser:
1. Mọi trang ở mục 1 hiển thị nền sáng, chữ đọc được, không còn vệt tối sót.
2. Mở `/signin` rồi sang trang khác — **không** còn bị kéo cả app sang tối.
3. `/interview` chuyển hướng; không còn lối vào nào ở sidebar, ⌘K, dashboard sidebar, footer.
4. Đăng nhập xong vào `/assistant`; vào `/` khi đã đăng nhập thì chuyển sang `/assistant`; khi chưa đăng nhập vẫn thấy landing.
5. **Ca bug CV:** upload một PDF hỏng ở bước 2 → phải đăng nhập được và điền tay tiếp được, **không** hiện "Email đã được đăng ký".

## Ngoài phạm vi

- Làm nút chuyển dark/light cho người dùng.
- Xoá hẳn mã nguồn tính năng phỏng vấn.
- Bỏ landing marketing ở `/`.
- Sửa backend `/api/cv/upload` (thông báo lỗi hiện đã rõ ràng và đúng tiếng Việt).
