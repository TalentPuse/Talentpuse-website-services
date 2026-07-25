# Theme trắng · Ẩn phỏng vấn · Trợ lý AI trang đầu · Sửa bug signup CV — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toàn site chạy theme trắng, ẩn tính năng luyện phỏng vấn, đưa Trợ lý AI làm trang đầu sau đăng nhập, và sửa bug signup-CV khiến một email bị khoá vĩnh viễn.

**Architecture:** Bốn thay đổi độc lập ở lớp vỏ ứng dụng. Theme chốt tại một điểm duy nhất (`forcedTheme` của next-themes) để đè cả localStorage cũ. Ẩn phỏng vấn = gỡ lối vào + redirect route, giữ nguyên mã nguồn. Bug CV sửa bằng cách tạo tài khoản **đúng một lần** cho cả phiên đăng ký. Spec: `docs/superpowers/specs/2026-07-25-light-theme-hide-interview-ai-home-cv-fix-design.md`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, `next-themes@0.4.6`, Tailwind v4, Jest + RTL.

## Global Constraints

- Mọi lệnh frontend chạy trong `apps/frontend`. Gate mỗi task: `npx tsc --noEmit` exit 0 và `npm test` xanh. Nền hiện tại: **10 suite / 94 test**.
- **NEVER `git add .` / `git add -A`.** Repo có noise (`apps/frontend/tsconfig.tsbuildinfo`). Stage đúng path nêu trong task.
- Identifier tiếng Anh; copy UI, comment và tên test tiếng Việt. Brand **"TalentPuse"** (không phải TalentPulse).
- Token màu hợp lệ: `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-text-muted`, `brand-*`, `ring-border`. **Class Tailwind phải là literal**, không ghép động.
- **KHÔNG đụng** chữ "Phỏng vấn" trong `components/applications/StatusSelect.tsx` và trang `/applications` — đó là tên **cột Kanban** (trạng thái `interviewing`), không phải tính năng luyện phỏng vấn.
- **KHÔNG đụng** `components/landing/sections/CareerJourney.tsx:18` — `["Tìm việc & làm việc", "Phỏng vấn tự tin", "Nhận offer"]` là lời kể hành trình nghề, không trỏ tới `/interview`.
- Không đổi API backend.

---

### Task 1: Theme trắng toàn site

**Files:**
- Modify: `apps/frontend/app/providers.tsx`
- Modify: `apps/frontend/app/page.tsx` (bỏ `<ForceTheme theme="light" />` + import)
- Modify: `apps/frontend/app/signin/page.tsx` (bỏ `<ForceTheme theme="dark" />` + import)
- Modify: `apps/frontend/app/signup/page.tsx` (bỏ `<ForceTheme theme="dark" />` + import)
- Modify: `apps/frontend/app/interview/page.tsx` (bỏ `<ForceTheme theme="dark" />` + import)
- Delete: `apps/frontend/components/theme/ForceTheme.tsx`
- Test: `apps/frontend/app/__tests__/providers-theme.test.tsx` (tạo)

**Interfaces:**
- Consumes: `ThemeProvider` từ `next-themes` (đã xác minh `forcedTheme?: string` có trong `node_modules/next-themes/dist/*.d.ts`)
- Produces: không có API mới. Task 2 sẽ ghi đè `app/interview/page.tsx` nên ở đó chỉ cần bỏ đúng dòng ForceTheme, không cần dọn thêm.

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/frontend/app/__tests__/providers-theme.test.tsx`:

```tsx
import { render } from "@testing-library/react";

const themeProviderProps: Record<string, unknown>[] = [];
jest.mock("next-themes", () => ({
  ThemeProvider: (props: Record<string, unknown>) => {
    themeProviderProps.push(props);
    return <>{props.children as React.ReactNode}</>;
  },
}));
jest.mock("sonner", () => ({ Toaster: () => null }));
jest.mock("@/context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { Providers } from "../providers";

describe("Providers — theme", () => {
  beforeEach(() => { themeProviderProps.length = 0; });

  it("ép theme sáng cho MỌI user, kể cả người đã lỡ lưu 'dark' trong localStorage", () => {
    render(<Providers><div /></Providers>);
    expect(themeProviderProps[0].forcedTheme).toBe("light");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest app/__tests__/providers-theme.test.tsx
```
Expected: FAIL — `forcedTheme` là `undefined`, không phải `"light"`.

- [ ] **Step 3: Thêm `forcedTheme` vào ThemeProvider**

Trong `apps/frontend/app/providers.tsx`, sửa đúng dòng `<ThemeProvider ...>` thành:

```tsx
    {/* forcedTheme: điểm chốt DUY NHẤT của theme. ForceTheme cũ gọi setTheme()
        nên next-themes đã GHI "dark" vào localStorage của mọi user từng ghé
        /signin, /signup hay /interview — chỉ xoá các chỗ ép dark là chưa đủ,
        họ vẫn thấy web tối. forcedTheme đè lên cả giá trị đã lưu.
        Bỏ đúng một dòng này là bật lại được dark mode. */}
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light" disableTransitionOnChange>
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest app/__tests__/providers-theme.test.tsx
```
Expected: PASS, 1 test.

- [ ] **Step 5: Gỡ ForceTheme khỏi 4 trang và xoá component**

Ở mỗi file dưới đây, xoá dòng JSX `<ForceTheme ... />` **và** dòng `import { ForceTheme } from "@/components/theme/ForceTheme";`:
- `apps/frontend/app/page.tsx` (`<ForceTheme theme="light" />`)
- `apps/frontend/app/signin/page.tsx` (`<ForceTheme theme="dark" />`)
- `apps/frontend/app/signup/page.tsx` (`<ForceTheme theme="dark" />`)
- `apps/frontend/app/interview/page.tsx` (`<ForceTheme theme="dark" />`)

Rồi xoá file:

```bash
cd apps/frontend && git rm components/theme/ForceTheme.tsx
```

Lý do xoá thay vì để lại: khi đã có `forcedTheme`, `setTheme()` không còn tác dụng, nên `ForceTheme` trở thành component im lặng không làm gì — để lại là cái bẫy cho người sửa sau.

- [ ] **Step 6: Kiểm tra không còn tham chiếu mồ côi**

```bash
cd apps/frontend && grep -rn "ForceTheme" app components lib | grep -v node_modules
```
Expected: **không có dòng nào**. Nếu còn, xoá nốt.

- [ ] **Step 7: Typecheck + toàn bộ suite**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; 11 suite / 95 test xanh.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/app/providers.tsx \
        apps/frontend/app/page.tsx \
        apps/frontend/app/signin/page.tsx \
        apps/frontend/app/signup/page.tsx \
        apps/frontend/app/interview/page.tsx \
        apps/frontend/app/__tests__/providers-theme.test.tsx \
        apps/frontend/components/theme/ForceTheme.tsx
git commit -m "feat(theme): ep theme sang toan site bang forcedTheme"
```

---

### Task 2: Ẩn tính năng luyện phỏng vấn

**Files:**
- Modify: `apps/frontend/components/shell/nav-items.ts`
- Modify: `apps/frontend/components/shell/CommandMenu.tsx`
- Modify: `apps/frontend/components/dashboard/DashboardSidebar.tsx`
- Modify: `apps/frontend/components/landing/sections/Footer.tsx`
- Replace: `apps/frontend/app/interview/page.tsx`
- Modify: `apps/frontend/components/copilot/BoardCopilot.tsx`
- Modify: `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`
- Test: `apps/frontend/components/shell/__tests__/nav-items.test.ts` (tạo)

**Interfaces:**
- Consumes: `NAV_ITEMS: NavItem[]` từ `components/shell/nav-items.ts`, với `NavItem = { href: string; label: string; icon: typeof LayoutDashboard }`
- Produces: `NAV_ITEMS` không còn phần tử nào có `href === "/interview"`. Task 3 sẽ đổi **thứ tự** mảng này — task này đừng khoá thứ tự trong test.

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/frontend/components/shell/__tests__/nav-items.test.ts`:

```ts
import { NAV_ITEMS } from "../nav-items";

describe("NAV_ITEMS", () => {
  it("KHÔNG còn lối vào luyện phỏng vấn", () => {
    expect(NAV_ITEMS.some((i) => i.href === "/interview")).toBe(false);
  });

  it("vẫn giữ đủ các mục còn lại", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining(["/dashboard", "/jobs", "/assistant", "/alerts", "/applications", "/profile"]),
    );
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/shell/__tests__/nav-items.test.ts
```
Expected: FAIL ở test đầu — `NAV_ITEMS` hiện vẫn có `/interview`.

- [ ] **Step 3: Gỡ 4 lối vào**

1. `apps/frontend/components/shell/nav-items.ts` — xoá đúng dòng:
```ts
  { href: "/interview", label: "Phỏng vấn", icon: MessageSquare },
```

2. `apps/frontend/components/shell/CommandMenu.tsx` — xoá đúng dòng:
```ts
  { label: "Luyện phỏng vấn", href: "/interview", icon: MessageSquare },
```

3. `apps/frontend/components/dashboard/DashboardSidebar.tsx` — xoá cả object có `href: "/interview"`, `label: "Luyện Phỏng Vấn"` (gồm cả chuỗi `icon` dài của nó).

4. `apps/frontend/components/landing/sections/Footer.tsx` — xoá cả khối:
```tsx
              <Link href="/interview" className="transition-colors hover:text-text">
                {t.footer.links.interview}
              </Link>
```

Sau mỗi lần xoá, nếu import `MessageSquare` không còn ai dùng thì xoá luôn import đó (tsc sẽ báo).

- [ ] **Step 4: Thay `app/interview/page.tsx` bằng redirect**

Ghi đè **toàn bộ** `apps/frontend/app/interview/page.tsx` bằng:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Tính năng luyện phỏng vấn đang được ẨN.
 *
 * Lối vào đã gỡ khỏi sidebar, ⌘K, dashboard sidebar và footer; trang này chặn
 * nốt đường vào thẳng bằng URL. `components/interview/*` vẫn còn nguyên trên
 * đĩa, và nội dung cũ của chính file này nằm trong lịch sử git — muốn bật lại
 * thì khôi phục từ đó, không phải viết lại.
 */
export default function InterviewPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/assistant");
  }, [router]);
  return null;
}
```

- [ ] **Step 5: Gỡ tool `start_interview_prep` khỏi dock**

Trong `apps/frontend/components/copilot/BoardCopilot.tsx`:
- Xoá **toàn bộ** khối `useDockTool({ name: "start_interview_prep", ... })` (khoảng dòng 325-355, từ `useDockTool({` tới `});` khép lại của nó).
- `router` giờ không còn chỗ dùng (`router.push` chỉ xuất hiện trong tool vừa xoá, dòng 351) ⇒ xoá cả `const router = useRouter();` (dòng 51) và `import { useRouter } from "next/navigation";` (dòng 3).

Trong `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`:
- Xoá **toàn bộ** khối `describe("BoardCopilot / start_interview_prep", ...)` (khoảng dòng 324-363).
- Nếu mock `next/navigation` (`mockPush`) chỉ phục vụ khối vừa xoá thì xoá luôn cả mock lẫn biến `mockPush`; nếu còn test khác dùng thì giữ.
- Sửa comment ở đầu file (khoảng dòng 45) đang liệt kê `start_interview_prep` — bỏ tên tool đó khỏi câu, đừng để comment nói về tool không còn tồn tại.

- [ ] **Step 6: Kiểm tra không còn lối vào nào sót**

```bash
cd apps/frontend && grep -rn "\"/interview\|'/interview\|start_interview_prep" app components lib | grep -v node_modules
```
Expected: chỉ còn dòng comment trong `app/interview/page.tsx` và `components/interview/*`. **Không** còn dòng nào trong `shell/`, `dashboard/`, `landing/`, `copilot/`.

- [ ] **Step 7: Typecheck + toàn bộ suite**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; toàn bộ xanh. Số test giảm vì đã gỡ khối `start_interview_prep`, và tăng 2 từ `nav-items.test.ts`.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/components/shell/nav-items.ts \
        apps/frontend/components/shell/CommandMenu.tsx \
        apps/frontend/components/dashboard/DashboardSidebar.tsx \
        apps/frontend/components/landing/sections/Footer.tsx \
        apps/frontend/app/interview/page.tsx \
        apps/frontend/components/copilot/BoardCopilot.tsx \
        apps/frontend/components/copilot/__tests__/board-copilot.test.tsx \
        apps/frontend/components/shell/__tests__/nav-items.test.ts
git commit -m "feat(nav): an tinh nang luyen phong van khoi moi loi vao"
```

---

### Task 3: Trợ lý AI làm trang đầu

**Files:**
- Modify: `apps/frontend/components/shell/nav-items.ts`
- Modify: `apps/frontend/app/signup/page.tsx`
- Modify: `apps/frontend/app/page.tsx`
- Modify: `apps/frontend/components/shell/__tests__/nav-items.test.ts`

**Interfaces:**
- Consumes: `AI_HOME` từ `@/lib/flags` (`export const AI_HOME = process.env.NEXT_PUBLIC_AI_HOME === "1"`), `useAuth()` từ `@/context/AuthContext`
- Produces: `NAV_ITEMS[0].href === "/assistant"`. Task 4 sẽ sửa tiếp `app/signup/page.tsx` — task này chỉ đụng phần redirect, **không** động vào `handleCvUpload`.

- [ ] **Step 1: Thêm test thất bại cho thứ tự nav**

Thêm vào `apps/frontend/components/shell/__tests__/nav-items.test.ts` (giữ nguyên 2 test đã có):

```ts
  it("Trợ lý AI đứng ĐẦU danh sách", () => {
    expect(NAV_ITEMS[0].href).toBe("/assistant");
  });
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/shell/__tests__/nav-items.test.ts
```
Expected: FAIL — phần tử đầu hiện là `/dashboard`.

- [ ] **Step 3: Đưa Trợ lý AI lên đầu**

Trong `apps/frontend/components/shell/nav-items.ts`, sắp lại `NAV_ITEMS` (giữ nguyên mọi mục, chỉ đổi thứ tự; `/interview` đã bị gỡ ở Task 2):

```ts
export const NAV_ITEMS: NavItem[] = [
  { href: "/assistant", label: "Trợ lý AI", icon: Sparkles },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs", label: "Việc làm", icon: Briefcase },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/applications", label: "Ứng tuyển", icon: ClipboardCheck },
  { href: "/profile", label: "Hồ sơ", icon: User },
];
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/shell/__tests__/nav-items.test.ts
```
Expected: PASS, 3 test.

- [ ] **Step 5: Signup redirect về `/assistant`**

Trong `apps/frontend/app/signup/page.tsx`, thêm hằng ngay dưới các import (`AI_HOME` đã được import sẵn ở dòng 10):

```tsx
/** Đích sau khi đăng ký xong — khớp đúng biểu thức mà /signin đang dùng,
 *  để hai đường đăng nhập và đăng ký không dẫn đi hai nơi khác nhau. */
const POST_AUTH_HOME = AI_HOME ? "/assistant" : "/dashboard";
```

Rồi thay **cả hai** dòng `router.push("/dashboard");` (một trong `onSubmit`, một trong `skipAndSubmit`) thành:

```tsx
      router.push(POST_AUTH_HOME);
```

- [ ] **Step 6: Trang gốc `/` đưa người đã đăng nhập sang `/assistant`**

Trong `apps/frontend/app/page.tsx`, thêm vào import:

```tsx
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AI_HOME } from "@/lib/flags";
```

Trong thân `LandingPage`, **trước** `return (`:

```tsx
  const router = useRouter();
  const { user, loading } = useAuth();

  // Người ĐÃ đăng nhập vào "/" thì đi thẳng tới Trợ lý AI; khách vãng lai vẫn
  // xem landing marketing (đó là kênh thu hút người dùng mới, không bỏ được).
  //
  // Phải đợi `loading` xong mới quyết định: AuthContext đọc token bất đồng bộ,
  // nếu điều hướng ngay ở lần render đầu thì user đã đăng nhập vẫn thấy landing
  // nháy lên một nhịp rồi mới nhảy — đúng cái bẫy hydrate đã gặp ở DockChat.
  useEffect(() => {
    if (!loading && user && AI_HOME) router.replace("/assistant");
  }, [loading, user, router]);
```

⚠️ Đọc `context/AuthContext.tsx` **trước** để lấy đúng tên field trạng thái đang tải (`loading`, `isLoading`, hay tên khác) và đúng tên field user. Dùng tên thật, đừng đoán theo mẫu trên.

- [ ] **Step 7: Typecheck + toàn bộ suite**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; toàn bộ xanh.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/components/shell/nav-items.ts \
        apps/frontend/components/shell/__tests__/nav-items.test.ts \
        apps/frontend/app/signup/page.tsx \
        apps/frontend/app/page.tsx
git commit -m "feat(nav): tro ly AI lam trang dau sau dang nhap"
```

---

### Task 4: Sửa bug signup CV khoá vĩnh viễn email

**Files:**
- Modify: `apps/frontend/app/signup/page.tsx`
- Test: `apps/frontend/app/__tests__/signup-cv.test.tsx` (tạo)

**Interfaces:**
- Consumes: `authApi.signup(payload)`, `authApi.getMe(token)`, `authApi.updateMe(token, data)` (PUT, nhận `Partial<Omit<UserResponse, "id" | "email" | "created_at">>`), `cvApi.upload(token, file)` — lưu ý `cvApi.upload` **throw** `Error(body.detail)` khi HTTP không ok, không trả về object lỗi.
- Produces: không có export mới.

**Bug đang sửa (đã tái hiện thật trên API đang chạy):** `handleCvUpload` gọi `authApi.signup` **trước**, `cvApi.upload` **sau**. CV lỗi ⇒ tài khoản đã tạo nhưng user không được đăng nhập, mà cả 3 đường thoát (`handleCvUpload`, `onSubmit`, `skipAndSubmit`) đều gọi `signup` lần nữa ⇒ backend trả `409 {"detail":"Email đã được đăng ký"}`. Người dùng kẹt cứng, không đăng ký tiếp được bằng email đó.

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/frontend/app/__tests__/signup-cv.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const signup = jest.fn();
const getMe = jest.fn();
const updateMe = jest.fn();
const uploadCv = jest.fn();

jest.mock("@/lib/api", () => ({
  authApi: {
    signup: (...a: unknown[]) => signup(...a),
    getMe: (...a: unknown[]) => getMe(...a),
    updateMe: (...a: unknown[]) => updateMe(...a),
  },
  cvApi: { upload: (...a: unknown[]) => uploadCv(...a) },
  ApiError: class ApiError extends Error {},
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const login = jest.fn();
jest.mock("@/context/AuthContext", () => ({ useAuth: () => ({ login }) }));

import SignUpPage from "../signup/page";

/** File PDF hợp lệ tối thiểu: 5 byte đầu phải là "%PDF-". */
function pdfFile(name = "cv.pdf", size = 1024) {
  const head = new TextEncoder().encode("%PDF-1.4\n");
  const body = new Uint8Array(Math.max(0, size - head.length));
  return new File([head, body], name, { type: "application/pdf" });
}

async function gotoStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/họ tên/i), "Nguyen Van A");
  await user.type(screen.getByLabelText(/email/i), "a@example.com");
  await user.type(screen.getByLabelText(/^mật khẩu/i), "MatKhau123!");
  await user.type(screen.getByLabelText(/xác nhận/i), "MatKhau123!");
  await user.click(screen.getByRole("button", { name: /tiếp tục/i }));
}

describe("Signup — upload CV", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signup.mockResolvedValue({ access_token: "tok-1" });
    getMe.mockResolvedValue({ id: "u1", email: "a@example.com" });
    updateMe.mockResolvedValue({});
  });

  it("CV lỗi thì KHÔNG gọi signup lần thứ hai khi thử lại (regression: email bị khoá vĩnh viễn)", async () => {
    const user = userEvent.setup();
    uploadCv.mockRejectedValue(new Error("Không thể đọc file PDF."));
    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());
    await waitFor(() => expect(uploadCv).toHaveBeenCalledTimes(1));

    await user.upload(input, pdfFile());
    await waitFor(() => expect(uploadCv).toHaveBeenCalledTimes(2));

    expect(signup).toHaveBeenCalledTimes(1);
  });

  it("CV lỗi vẫn đăng nhập user vào, không bỏ mặc ở màn hình lỗi", async () => {
    const user = userEvent.setup();
    uploadCv.mockRejectedValue(new Error("Không thể đọc file PDF."));
    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile());

    await waitFor(() => expect(login).toHaveBeenCalledWith("tok-1", expect.anything()));
  });

  it("từ chối file quá 5MB TRƯỚC khi tạo tài khoản", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    await gotoStep2(user);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, pdfFile("big.pdf", 6 * 1024 * 1024));

    await waitFor(() => expect(screen.getByText(/5MB/i)).toBeInTheDocument());
    expect(signup).not.toHaveBeenCalled();
    expect(uploadCv).not.toHaveBeenCalled();
  });

  it("từ chối file đổi tên thành .pdf nhưng ruột không phải PDF", async () => {
    const user = userEvent.setup();
    render(<SignUpPage />);
    await gotoStep2(user);

    const fake = new File([new TextEncoder().encode("MZ not a pdf")], "cv.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, fake);

    await waitFor(() => expect(screen.getByText(/không phải (file )?PDF/i)).toBeInTheDocument());
    expect(signup).not.toHaveBeenCalled();
  });
});
```

⚠️ Nhãn dùng trong `gotoStep2` phải khớp **label thật** trong `app/signup/page.tsx`. Đọc file rồi chỉnh selector cho đúng — **được phép sửa selector, KHÔNG được nới lỏng assertion**.

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest app/__tests__/signup-cv.test.tsx
```
Expected: FAIL. Test 1 fail vì `signup` bị gọi 2 lần; test 2 fail vì `login` không được gọi; test 3 và 4 fail vì chưa có validate.

- [ ] **Step 3: Thêm tiện ích validate + tạo tài khoản một lần**

Trong `apps/frontend/app/signup/page.tsx`, thêm ở phạm vi module (ngoài component):

```tsx
const MAX_CV_BYTES = 5 * 1024 * 1024;

/** Đọc 5 byte đầu để xác nhận đúng là PDF. Chỉ tin đuôi tên file thì đổi tên
 *  `bat-ky.exe` thành `cv.pdf` là lọt thẳng tới server. */
async function looksLikePdf(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return new TextDecoder().decode(head) === "%PDF-";
}
```

Trong thân component, thêm ref (nhớ thêm `useRef` vào import từ `react`):

```tsx
  // Token của lần signup THÀNH CÔNG đầu tiên trong phiên đăng ký này.
  //
  // Đây là chỗ sửa bug: trước đây mỗi đường đi (upload CV / nhập tay / bỏ qua)
  // đều tự gọi authApi.signup, nên khi CV phân tích lỗi thì tài khoản ĐÃ được
  // tạo mà user chưa đăng nhập, và mọi lần thử lại đều đâm vào
  // 409 "Email đã được đăng ký" — email đó coi như hỏng vĩnh viễn.
  const createdTokenRef = useRef<string | null>(null);
```

Thêm hàm trong component:

```tsx
  /** Tạo tài khoản đúng MỘT lần. Lần sau chỉ cập nhật hồ sơ trên tài khoản đã có. */
  async function ensureAccount(profile: Record<string, unknown>): Promise<string> {
    if (createdTokenRef.current) {
      await authApi.updateMe(createdTokenRef.current, profile);
      return createdTokenRef.current;
    }
    const { access_token } = await authApi.signup({ email, password, full_name: fullName, ...profile });
    createdTokenRef.current = access_token;
    return access_token;
  }
```

⚠️ Đọc type `SignupPayload` và `UserResponse` trong `lib/api.ts` trước, để biết `updateMe` nhận đúng những field nào. `email`, `password`, `full_name` **không** được đưa vào `profile` — chúng chỉ thuộc payload của `signup`.

- [ ] **Step 4: Viết lại `handleCvUpload`**

Thay **toàn bộ** hàm `handleCvUpload` bằng:

```tsx
  async function handleCvUpload(file: File) {
    setCvError("");

    // Chặn sớm, TRƯỚC khi tạo tài khoản — hỏng ở đây thì chưa có gì để dọn.
    if (file.size > MAX_CV_BYTES) {
      setCvError("File vượt quá 5MB, bạn chọn file nhỏ hơn nhé.");
      setCvStep("error");
      return;
    }
    if (!(await looksLikePdf(file))) {
      setCvError("File này không phải PDF hợp lệ.");
      setCvStep("error");
      return;
    }

    setCvFileName(file.name);
    setCvStep("analyzing");

    let token: string;
    try {
      token = await ensureAccount({ skills: [], preferred_cities: [], desired_titles: [] });
    } catch (err) {
      setCvError((err as ApiError).message || "Không tạo được tài khoản");
      setCvStep("error");
      return;
    }

    try {
      await cvApi.upload(token, file);
      setCvStep("done");
      const user = await authApi.getMe(token);
      login(token, user);
      toast.success("CV đã được phân tích! Kiểm tra và cập nhật profile.");
      router.push("/profile");
    } catch (err) {
      // Tài khoản ĐÃ tạo xong — đăng nhập user vào rồi mời điền tay, thay vì
      // bỏ mặc họ ở màn hình lỗi với một tài khoản họ không biết là đã có.
      const user = await authApi.getMe(token);
      login(token, user);
      setCvError(
        `${(err as ApiError).message || "Không đọc được CV"} Tài khoản đã tạo xong — bạn điền thông tin tay giúp nhé.`,
      );
      setCvStep("error");
      setStep2Mode("manual");
    }
  }
```

Chú ý: `await new Promise((r) => setTimeout(r, 600))` và `setCvStep("reading")` của bản cũ đã **bỏ hẳn** — đó là độ trễ giả chỉ để thanh tiến trình trông đẹp, làm mọi lần upload chậm thêm 0.6s vô ích.

⚠️ `cvStep === "reading"` có thể còn được dùng trong JSX bên dưới. Đọc kỹ và chỉnh JSX cho khớp các trạng thái còn lại, đừng để nhánh chết.

- [ ] **Step 5: Cho `onSubmit` và `skipAndSubmit` dùng chung `ensureAccount`**

Trong `onSubmit`, thay `const { access_token } = await authApi.signup(payload);` bằng:

```tsx
      const access_token = await ensureAccount(profileFields);
```

trong đó `profileFields` là đúng `payload` cũ **bỏ đi** `email`, `password`, `full_name`.

Trong `skipAndSubmit`, thay tương tự:

```tsx
      const access_token = await ensureAccount({ skills: [], preferred_cities: [], desired_titles: [] });
```

Phần còn lại của hai hàm (`getMe`, `login`, `toast`, `router.push(POST_AUTH_HOME)`) giữ nguyên.

- [ ] **Step 6: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest app/__tests__/signup-cv.test.tsx
```
Expected: PASS, 4 test.

- [ ] **Step 7: Typecheck + toàn bộ suite**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; toàn bộ xanh.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/app/signup/page.tsx apps/frontend/app/__tests__/signup-cv.test.tsx
git commit -m "fix(signup): khong signup lai khi CV loi, them check size va magic-byte PDF"
```

---

### Task 5: Verify tay (controller — cần Docker + browser)

**Files:** không file mới (trừ khi vá lỗi tìm thấy).

- [ ] **Step 1: Rebuild**

```bash
cd /d/TalentPulse/talentpulse
PW=$(docker inspect talentpulse-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSTGRES_PASSWORD=' | cut -d= -f2)
export DATABASE_URL="postgresql://admin:${PW}@talentpulse-postgres:5432/warehouse"
export MCP_DATABASE_URL="$DATABASE_URL"
NEXT_PUBLIC_AI_HOME=1 NEXT_PUBLIC_COPILOT_DOCK=1 docker compose build frontend
docker compose up -d --no-build frontend
```

Nếu `tp-backend` bị tạo lại thì phải nối mạng lúc container đang **STOPPED** (nối lúc đang chạy sẽ báo "network sandbox not found"):
```bash
docker stop tp-backend; docker network connect talentpulse tp-backend; docker start tp-backend
```
Backend nghe cổng **8001**, không phải 8000.

- [ ] **Step 2: Checklist**

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | Xoá localStorage rồi mở `/`, `/signin`, `/signup`, `/assistant`, `/jobs`, `/applications`, `/alerts`, `/profile`, `/dashboard` | Tất cả nền **sáng**, chữ đọc được, không còn mảng tối sót |
| 2 | Mở `/signin` rồi sang `/jobs` | **Không** bị kéo cả app sang tối (bug cũ) |
| 3 | Đặt tay `localStorage.theme = "dark"` rồi reload | Vẫn ra nền **sáng** (forcedTheme đè được giá trị cũ) |
| 4 | Nhìn sidebar, ⌘K, dashboard sidebar, footer landing | **Không** còn mục luyện phỏng vấn ở đâu cả |
| 5 | Vào thẳng `http://localhost:8002/interview` | Chuyển hướng sang `/assistant` |
| 6 | Ở `/applications` bảo AI "muốn luyện phỏng vấn cho job X" | AI **không** điều hướng đi đâu (tool đã gỡ) |
| 7 | Đăng nhập | Vào thẳng `/assistant`; "Trợ lý AI" là mục **đầu** sidebar |
| 8 | Đang đăng nhập, mở `/` | Chuyển sang `/assistant`, **không** nháy landing |
| 9 | Ẩn danh, mở `/` | Vẫn thấy landing marketing |
| 10 | **Ca bug CV:** đăng ký email mới, bước 2 upload một PDF hỏng | Báo lỗi CV **và** đã đăng nhập; điền tay tiếp được; **không** hiện "Email đã được đăng ký" |
| 11 | Cột Kanban ở `/applications` | Vẫn đủ 5 cột, cột "Phỏng vấn" **còn nguyên** |

- [ ] **Step 3: Dọn dữ liệu test**

```bash
docker exec talentpulse-postgres psql -U admin -d warehouse -c \
  "delete from app.users where email like '%@example.com' and email <> 'uitest@example.com';"
```

- [ ] **Step 4: Gate cuối**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tất cả xanh.

---

## Ngoài phạm vi plan này

- Nút chuyển dark/light cho người dùng.
- Xoá hẳn mã nguồn tính năng phỏng vấn (`components/interview/*` giữ nguyên trên đĩa).
- Bỏ landing marketing ở `/`.
- Sửa backend `/api/cv/upload`.
