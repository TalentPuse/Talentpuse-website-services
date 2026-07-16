# AI Copilot Dock v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dock AI bên phải ở `/jobs` và `/applications` — thấy ngữ cảnh trang, làm task bằng ngôn ngữ tự nhiên (lọc job, lưu/apply, kéo card), và đưa insight chủ động.

**Architecture:** CopilotKit v2 (đã wired: `/api/copilotkit` → FastAPI `/api/agent` LangGraph + checkpoint Postgres). Actions chạy trong browser qua frontend-tools; handler gọi đúng state setters/API client sẵn có của trang. Insight tab gọi thẳng REST. Spec: `docs/superpowers/specs/2026-07-16-ai-copilot-dock-design.md`.

**Tech Stack:** Next.js 14, `@copilotkit/react-core@1.62.3` (v2 namespace), Tailwind v4 (CSS-first tokens), Jest + RTL, FastAPI + LangChain agent middleware.

## Global Constraints

- **Repo đang có ~15 file uncommitted từ feature trước (saved-branch + Kanban). TUYỆT ĐỐI không `git add .` / `git add -A`** — mỗi commit stage đúng các path nêu trong task.
- Flag mới: `NEXT_PUBLIC_COPILOT_DOCK` — chỉ `"1"` là bật. Flag tắt ⇒ 2 trang giữ nguyên hành vi hiện tại (zero regression).
- **AI không được xoá** application — không expose bất kỳ delete tool nào.
- Copy tiếng Việt, identifier tiếng Anh. Brand viết "TalentPuse".
- Token màu dùng bộ sẵn có: `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-text-muted`, `brand-*`, `ring-border`.
- Gate mỗi task: `npx tsc --noEmit` exit 0 (chạy trong `apps/frontend`).
- Dev env đang chạy sẵn: frontend dev `http://localhost:8002` (background task `bjvbb21p2`), backend `http://localhost:8001` (container `tp-backend`; nạp code backend mới bằng `docker cp <file> tp-backend:/app/<path> && docker restart tp-backend`). User test: `uitest@example.com` / `TestWorkflow123!`.
- Verify runtime qua Chrome DevTools MCP; **kéo-thả không dùng được tool `drag`** (mouse events) — dnd-kit cần pointer events (xem transcript session 2026-07-16), nhưng dock không cần drag.

## File Structure (toàn cục)

```
apps/frontend/
  lib/flags.ts                      # + COPILOT_DOCK
  components/copilot/
    copilot-bridge.tsx              # Task 1 — wrapper useDockTool/useDockContext + types
    CopilotDockProvider.tsx         # Task 2 — provider + flag gate + auth headers
    CopilotDock.tsx                 # Task 2 — panel UI (tabs, collapse, mobile sheet)
    DockChat.tsx                    # Task 2 — CopilotChat, threadId dock-{userId}
    JobsCopilot.tsx                 # Task 3 — context + tools cho /jobs (null-render)
    BoardCopilot.tsx                # Task 4 — context + tools cho /applications
    resolve-card.ts                 # Task 4 — pure fn khử nhập nhằng tên card
    DockInsight.tsx                 # Task 5 — insight theo trang + nudge strip
    __tests__/resolve-card.test.ts  # Task 4
    __tests__/jobs-copilot.test.tsx # Task 3
  app/jobs/page.tsx                 # Task 3 — bọc provider + render JobsCopilot
  app/applications/page.tsx         # Task 4 — bọc provider + render BoardCopilot
apps/backend/app/services/agent/tools/
  market_tools.py                   # Task 6 — salary benchmark + company hiring
apps/backend/app/services/agent/chains/skill_advisor_chain.py  # Task 6 — thêm vào _BASE_TOOLS
apps/backend/tests/test_agent/test_market_tools.py             # Task 6
```

---

### Task 1: Flag + copilot-bridge + echo spike (verify tool round-trip)

Rủi ro số 1 của spec (§14.1): xác nhận frontend tool được forward tới agent LangGraph và agent gọi lại được. Task này chốt API thật của lib rồi khoá nó sau wrapper — **mọi task sau chỉ dùng wrapper**, không đụng lib trực tiếp.

**Files:**
- Modify: `apps/frontend/lib/flags.ts`
- Create: `apps/frontend/components/copilot/copilot-bridge.tsx`

**Interfaces (Produces — các task sau dựa vào đúng chữ ký này):**
```ts
export type DockToolParam = {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
  enum?: string[];
};
export type DockTool = {
  name: string;                       // snake_case, vd "set_job_filters"
  description: string;                // tiếng Anh, nói rõ khi nào dùng
  parameters: DockToolParam[];
  handler: (args: Record<string, unknown>) => Promise<string>; // string = kết quả LLM đọc
};
export function useDockTool(tool: DockTool): void;
export function useDockContext(description: string, value: unknown): void;
```

- [ ] **Step 1: Thêm flag** — cuối `lib/flags.ts`:

```ts
/** Bật dock AI copilot ở /jobs + /applications. Kill-switch độc lập với AI_HOME. */
export const COPILOT_DOCK = process.env.NEXT_PUBLIC_COPILOT_DOCK === "1";
```

- [ ] **Step 2: Xác định API v2 thật của lib** (đừng đoán tên hook):

```bash
cd apps/frontend
grep -o "useFrontendTool\|useCopilotAction\|useHumanInTheLoop\|addContext\|useAgentContext\|useCopilotReadable" node_modules/@copilotkit/react-core/dist/*.d.mts | sort | uniq -c
```

Đọc thêm block khai báo hook tìm được trong file `.d.mts` đó (định nghĩa props/param). Tham khảo `apps/frontend/.agents/skills/copilotkit-develop/` nếu cần. Ghi tên hook thật vào comment đầu `copilot-bridge.tsx`.

- [ ] **Step 3: Viết `copilot-bridge.tsx`** — types như Interfaces trên + 2 wrapper map `DockTool`/context vào hook v2 vừa xác định (map `parameters` sang schema lib yêu cầu; handler trả string). File này là NƠI DUY NHẤT import hook tool/context của lib.

- [ ] **Step 4: Echo spike tạm** — trong `app/jobs/page.tsx` thêm tạm (đánh dấu `// SPIKE — remove`):

```tsx
function EchoSpike() {
  useDockTool({
    name: "echo_test",
    description: "Echo back the given text. Use when the user asks to echo something.",
    parameters: [{ name: "text", type: "string", description: "text to echo", required: true }],
    handler: async (args) => `ECHO:${String(args.text)}`,
  });
  return null;
}
```

Bọc tạm `<Content/>` trong `<CopilotKit runtimeUrl="/api/copilotkit">` (import từ `@copilotkit/react-core/v2` + auth child dùng `useCopilotKit().copilotkit.setHeaders({ ...copilotkit.headers, Authorization: \`Bearer ${token}\` })` — pattern y hệt `components/chat/CopilotChatSurface.tsx:100-110`) + một `<CopilotChat threadId="spike-test"/>` tạm.

- [ ] **Step 5: Verify round-trip trên browser** — chạy dev với `NEXT_PUBLIC_COPILOT_DOCK=1`; login `uitest@example.com`, vào `/jobs`, chat: "echo lại chữ hello". Expected: assistant trả lời chứa `ECHO:hello` (tool được gọi ở browser). Nếu agent KHÔNG gọi tool → đọc `apps/frontend/.agents/skills/copilotkit-agui/` + kiểm tra `CopilotKitMiddleware` phía backend (`grep -rn "CopilotKitMiddleware" apps/backend/app/services/agent/`) — sửa nhỏ ở `build_agent` nếu middleware chưa gắn, nạp bằng `docker cp` + restart, thử lại. **Không sang Task 2 khi echo chưa chạy.**

- [ ] **Step 6: Gỡ spike** — xoá `EchoSpike`, provider tạm, CopilotChat tạm khỏi `app/jobs/page.tsx` (file về nguyên trạng).

- [ ] **Step 7: Typecheck + commit**

```bash
cd apps/frontend && npx tsc --noEmit
git add apps/frontend/lib/flags.ts apps/frontend/components/copilot/copilot-bridge.tsx
git commit -m "feat(copilot): flag + bridge wrappers, verified frontend-tool round-trip"
```

---

### Task 2: CopilotDockProvider + CopilotDock shell + DockChat

**Files:**
- Create: `apps/frontend/components/copilot/CopilotDockProvider.tsx`, `CopilotDock.tsx`, `DockChat.tsx`

**Interfaces:**
- Consumes: `COPILOT_DOCK` (Task 1).
- Produces:
  - `<CopilotDockProvider page="jobs" | "applications" insight={ReactNode}>{children}</CopilotDockProvider>` — flag tắt ⇒ render `<>{children}</>` nguyên vẹn; bật ⇒ bọc CopilotKit provider, layout `flex h-full min-h-0`: children trong `<div className="min-w-0 flex-1 overflow-y-auto">`, dock là cột phải.
  - `<CopilotDock page={page} insight={insight}/>` nội bộ provider (không export dùng ngoài).

- [ ] **Step 1: `DockChat.tsx`**

```tsx
"use client";
import { CopilotChat } from "@copilotkit/react-core/v2";
import { useAuth } from "@/context/AuthContext";

/** Chat của dock — thread riêng theo user, KHÔNG đăng ký vào room list /assistant. */
export default function DockChat() {
  const { user } = useAuth();
  if (!user) return null;
  return <CopilotChat threadId={`dock-${user.id}`} className="h-full min-h-0" />;
}
```

(Nếu `CopilotChat` 1.62.3 không nhận `className`, bọc `<div className="h-full min-h-0">`.)

- [ ] **Step 2: `CopilotDock.tsx`** — panel UI:

```tsx
"use client";
import { useEffect, useState } from "react";
import { PanelRightClose, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import DockChat from "./DockChat";

const OPEN_KEY = "tp_copilot_open";
type Tab = "chat" | "insight";

export default function CopilotDock({
  page,
  insight,
}: { page: "jobs" | "applications"; insight?: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setOpen(localStorage.getItem(OPEN_KEY) !== "0"); }, []);
  function toggle() {
    setOpen((v) => { localStorage.setItem(OPEN_KEY, v ? "0" : "1"); return !v; });
  }

  const tabs = (
    <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
      <Sparkles className="h-4 w-4 text-brand-500" strokeWidth={1.75} />
      {(["chat", "insight"] as Tab[]).map((t) => (
        <button key={t} onClick={() => setTab(t)}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium",
            tab === t ? "bg-brand-50 text-brand-700" : "text-text-muted hover:bg-surface-2")}>
          {t === "chat" ? "Chat" : "Insight"}
        </button>
      ))}
      <button onClick={toggle} aria-label="Thu gọn trợ lý"
        className="ml-auto hidden rounded-md p-1.5 text-text-muted hover:bg-surface-2 lg:block">
        <PanelRightClose className="h-4 w-4" strokeWidth={1.75} />
      </button>
      <button onClick={() => setMobileOpen(false)} aria-label="Đóng"
        className="ml-auto rounded-md p-1.5 text-text-muted hover:bg-surface-2 lg:hidden">
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );

  const body = (
    <>
      {tabs}
      <div className={cn("min-h-0 flex-1", tab !== "chat" && "hidden")}><DockChat /></div>
      {tab === "insight" && <div className="min-h-0 flex-1 overflow-y-auto p-3">{insight}</div>}
    </>
  );

  return (
    <>
      {/* Desktop: cột phải */}
      {open ? (
        <aside aria-label="Trợ lý AI"
          className="hidden w-[380px] shrink-0 flex-col border-l border-border bg-surface lg:flex">
          {body}
        </aside>
      ) : (
        <button onClick={toggle} aria-label="Mở trợ lý AI"
          className="fixed bottom-5 right-5 z-40 hidden rounded-full bg-brand-600 p-3 text-white shadow-lg hover:bg-brand-700 lg:block">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}
      {/* Mobile: nút nổi + sheet */}
      <button onClick={() => setMobileOpen(true)} aria-label="Mở trợ lý AI"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-brand-600 p-3 text-white shadow-lg lg:hidden">
        <Sparkles className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface lg:hidden">{body}</div>
      )}
    </>
  );
}
```

Ghi chú: giữ `DockChat` mounted khi đổi tab (ẩn bằng `hidden`) để không mất stream đang chạy.

- [ ] **Step 3: `CopilotDockProvider.tsx`**

```tsx
"use client";
import "@copilotkit/react-core/v2/styles.css";
import "@/app/copilotkit-theme.css";
import { useEffect } from "react";
import { CopilotKit, useCopilotKit } from "@copilotkit/react-core/v2";
import { useAuth } from "@/context/AuthContext";
import { COPILOT_DOCK } from "@/lib/flags";
import CopilotDock from "./CopilotDock";

/** setHeaders GHI ĐÈ — phải spread headers hiện có (CopilotChatSurface.tsx:100-110). */
function AuthHeaders() {
  const { token } = useAuth();
  const { copilotkit } = useCopilotKit();
  useEffect(() => {
    if (token) copilotkit.setHeaders({ ...copilotkit.headers, Authorization: `Bearer ${token}` });
  }, [token, copilotkit]);
  return null;
}

export default function CopilotDockProvider({
  page, insight, children,
}: { page: "jobs" | "applications"; insight?: React.ReactNode; children: React.ReactNode }) {
  if (!COPILOT_DOCK) return <>{children}</>;
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <AuthHeaders />
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
        <CopilotDock page={page} insight={insight} />
      </div>
    </CopilotKit>
  );
}
```

- [ ] **Step 4: Verify tay** — chạy dev với `NEXT_PUBLIC_COPILOT_DOCK=1`, bọc thử `/jobs` (chính thức ở Task 3): dock hiện cột phải, chat hỏi "skill nào đang hot?" có trả lời (agent + MCP chạy), collapse rồi F5 giữ trạng thái, tắt flag ⇒ trang nguyên trạng.

- [ ] **Step 5: Typecheck + commit**

```bash
cd apps/frontend && npx tsc --noEmit
git add apps/frontend/components/copilot/CopilotDockProvider.tsx apps/frontend/components/copilot/CopilotDock.tsx apps/frontend/components/copilot/DockChat.tsx
git commit -m "feat(copilot): dock shell + provider + chat thread rieng"
```

---

### Task 3: JobsCopilot — context + `set_job_filters` + `capture_job`

**Files:**
- Create: `apps/frontend/components/copilot/JobsCopilot.tsx`, `apps/frontend/components/copilot/__tests__/jobs-copilot.test.tsx`
- Modify: `apps/frontend/app/jobs/page.tsx`

**Interfaces:**
- Consumes: `useDockTool`, `useDockContext` (Task 1); từ `lib/api.ts`: `applicationsApi.create/update`, `PublicJobRow`, `TrackedKey`, `FilterOptions`.
- Produces:

```tsx
export type JobsCopilotProps = {
  jobs: PublicJobRow[];                    // trang hiện tại (≤20)
  filters: { search: string; city: string; level: string; source: string; category: string; salary: string };
  filterOptions: FilterOptions | null;     // để AI chọn đúng giá trị hợp lệ
  setFilters: (f: Partial<JobsCopilotProps["filters"]> & { has_salary?: boolean }) => void; // page tự reset page=1
  trackedKeys: Map<string, TrackedKey>;
  onTracked: (entry: TrackedKey) => void;
  token: string;
};
export default function JobsCopilot(props: JobsCopilotProps): null;
```

- [ ] **Step 1: Viết test fail trước** — `__tests__/jobs-copilot.test.tsx`. Mock bridge để chộp tool đã đăng ký:

```tsx
const registered: Record<string, any> = {};
jest.mock("../copilot-bridge", () => ({
  useDockTool: (t: any) => { registered[t.name] = t; },
  useDockContext: jest.fn(),
}));
jest.mock("@/lib/api", () => ({
  applicationsApi: { create: jest.fn(), update: jest.fn() },
}));
```

4 case (render `<JobsCopilot {...props}/>` bằng RTL rồi gọi `registered["..."].handler({...})`):
1. `set_job_filters` với `{city: "HCMC", search: "data"}` → `setFilters` nhận đúng payload, kết quả trả về chứa "Đã áp dụng".
2. `capture_job` job có trong `jobs`, chưa track → `applicationsApi.create` được gọi với `{source, source_job_id, status}` + `onTracked` được gọi.
3. `capture_job` `status:"applied"` khi `trackedKeys` đã có entry `saved` → `applicationsApi.update(token, id, {status:"applied"})`, KHÔNG gọi create.
4. `capture_job` job không nằm trong `jobs` → trả string chứa "Không thấy" và KHÔNG gọi api nào.

- [ ] **Step 2: Chạy fail** — `cd apps/frontend && npx jest components/copilot --no-coverage`. Expected: FAIL (module chưa tồn tại).

- [ ] **Step 3: Implement `JobsCopilot.tsx`** — null-render component:
  - `useDockContext("Current page", { page: "jobs" })`
  - `useDockContext("Active job filters", filters)` + `useDockContext("Available filter options", filterOptions)`
  - `useDockContext("Jobs visible on this page", jobs.map(j => ({ source: j.source, source_job_id: j.source_job_id, title: j.title, company: j.company_name, city: j.city_canonical, salary_million: j.salary_million, skills: j.skills.slice(0, 6) })))`
  - Tool `set_job_filters` (params: search/city/level/source/category string optional; has_salary boolean optional; description: "Set the job board filters. Use values from 'Available filter options'. Pass only fields to change.") → handler gọi `setFilters`, trả `"Đã áp dụng bộ lọc: " + JSON.stringify(args)`.
  - Tool `capture_job` (params: `source` string required, `source_job_id` string required, `status` enum ["saved","applied"] required; description nêu rõ lấy source/source_job_id từ context "Jobs visible on this page") → handler: job không thuộc `jobs` ⇒ `"Không thấy job đó trên trang hiện tại"`; tracked `saved` + yêu cầu `applied` ⇒ `applicationsApi.update(token, tracked.id, { status: "applied" })`; tracked applied+ ⇒ `"Job này đã có trong Ứng tuyển"`; chưa track ⇒ `applicationsApi.create(token, { source, source_job_id, status })`. Nhánh mutate xong gọi `onTracked({ id, source, source_job_id, status })` và trả string kết quả. Try/catch → trả `"Lỗi: ..."` để LLM thuật lại.

- [ ] **Step 4: Chạy pass** — `npx jest components/copilot --no-coverage`. Expected: 4 PASS.

- [ ] **Step 5: Wire vào `app/jobs/page.tsx`** — `JobBoardPage` bọc `<CopilotDockProvider page="jobs">` quanh `<JobBoardContent/>` (Task 5 sẽ điền `insight`); trong `JobBoardContent` viết helper `applyPatch(partial)` (gọi từng setter tương ứng + `setPage(1)`; `has_salary: true→"yes", false→"no"`) rồi render:

```tsx
{COPILOT_DOCK && token && (
  <JobsCopilot
    jobs={data?.jobs ?? []}
    filters={{ search, city: cityFilter, level: levelFilter, source: sourceFilter, category: categoryFilter, salary: salaryFilter }}
    filterOptions={filters}
    setFilters={applyPatch}
    trackedKeys={trackedKeys}
    onTracked={handleTracked}
    token={token}
  />
)}
```

- [ ] **Step 6: Verify tay trên browser** — flag bật, `/jobs`: "tìm job data analyst ở HCMC" → search/city đổi + list reload; "lưu job đầu tiên đang hiện" → nút card đổi "Đã lưu"; "đánh dấu đã apply job đó" → nâng cấp applied. Console không lỗi mới.

- [ ] **Step 7: Typecheck + commit**

```bash
cd apps/frontend && npx tsc --noEmit
git add apps/frontend/components/copilot/JobsCopilot.tsx apps/frontend/components/copilot/__tests__/jobs-copilot.test.tsx apps/frontend/app/jobs/page.tsx
git commit -m "feat(copilot): jobs context + set_job_filters + capture_job"
```

---

### Task 4: BoardCopilot — `move_application` + khử nhập nhằng

**Files:**
- Create: `apps/frontend/components/copilot/resolve-card.ts`, `BoardCopilot.tsx`, `__tests__/resolve-card.test.ts`
- Modify: `apps/frontend/app/applications/page.tsx`

**Interfaces:**
- Consumes: bridge (Task 1); `Application`, `ApplicationStatus` từ `lib/api.ts`; `changeStatus(id, status)` + `apps` state của page (đã có sẵn trong `Content`).
- Produces:

```ts
// resolve-card.ts — pure, test không cần React
export type CardMatch = { id: string; title: string; company: string | null; status: string };
export function resolveCard(apps: Application[], query: string):
  | { kind: "one"; card: CardMatch }
  | { kind: "many"; candidates: CardMatch[] }   // ≥2 khớp — AI phải hỏi lại
  | { kind: "none" };
// Ưu tiên: exact id > exact title (toLowerCase) > title/company chứa query (toLowerCase). Candidates tối đa 5.

export default function BoardCopilot(props: {
  apps: Application[];
  onStatusChange: (id: string, s: ApplicationStatus) => void;
  token: string;
}): null;
```

- [ ] **Step 1: Test fail cho `resolveCard`** — `__tests__/resolve-card.test.ts`, 5 case: exact title → `one`; substring duy nhất → `one`; 2 card cùng chứa "Data" → `many` + candidates đúng; không khớp → `none`; khi vừa có exact vừa có substring → exact thắng (`one`).
- [ ] **Step 2: Chạy fail** — `npx jest resolve-card --no-coverage` → FAIL.
- [ ] **Step 3: Implement `resolve-card.ts`** theo đúng thứ tự ưu tiên.
- [ ] **Step 4: Chạy pass.**
- [ ] **Step 5: Implement `BoardCopilot.tsx`**:
  - `useDockContext("Application board", { counts: <đếm theo status>, cards: apps.map(a => ({ id: a.id, title: a.title, company: a.company_name, status: a.status, applied_at: a.applied_at, days_since_applied: <số ngày từ applied_at, null nếu thiếu> })) })`
  - Tool `move_application` (params: `card` string required — "card id OR title as shown on the board"; `status` enum saved|applied|interviewing|offer|rejected required): handler dùng `resolveCard`; `none` → "Không tìm thấy card ..."; `many` → `"Có N card khớp: <title — company (status)>; .... Hỏi user chọn cái nào rồi gọi lại với id."`; `one` → nếu status đã đúng thì nói vậy, khác thì `onStatusChange(card.id, status)` + "Đã chuyển ... sang ...". **Không có tool xoá.**
- [ ] **Step 6: Wire `app/applications/page.tsx`** — `ApplicationsPage` bọc `<CopilotDockProvider page="applications">` quanh `<Content/>`; trong `Content` render `{COPILOT_DOCK && token && <BoardCopilot apps={apps} onStatusChange={changeStatus} token={token}/>}`. Root của `Content` (`mx-auto flex h-full max-w-[1600px] flex-col p-6`) nằm trong cột `flex-1 overflow-y-auto` của provider vẫn đúng — board tự quản chiều cao.
- [ ] **Step 7: Verify tay** — `/applications`: "chuyển Data Analyst sang offer" → card nhảy cột, reload còn nguyên; tạo 2 card tên gần giống, yêu cầu mơ hồ → AI liệt kê và hỏi lại.
- [ ] **Step 8: Typecheck + commit**

```bash
cd apps/frontend && npx tsc --noEmit
git add apps/frontend/components/copilot/resolve-card.ts apps/frontend/components/copilot/BoardCopilot.tsx apps/frontend/components/copilot/__tests__/resolve-card.test.ts apps/frontend/app/applications/page.tsx
git commit -m "feat(copilot): board context + move_application + disambiguation"
```

---

### Task 5: DockInsight + nudge strip (nối endpoint recommendations mồ côi)

**Files:**
- Create: `apps/frontend/components/copilot/DockInsight.tsx`
- Modify: `apps/frontend/app/jobs/page.tsx`, `apps/frontend/app/applications/page.tsx` (truyền `insight=`)

**Interfaces:**
- Consumes: `recommendationsApi.get(token)` → `CareerRecommendations` (`lib/api.ts:466-489`: `target_roles`, `market_fit{matching_jobs, matching_jobs_in_city, cities}`, `your_strengths`, `skill_gaps`, `narrative`); `applicationsApi.aiSummary(token)` → `{summary_md, generated_at}`.
- Produces: `<DockInsight page="jobs"|"applications" apps?: Application[] />`.

- [ ] **Step 1: Implement `DockInsight.tsx`**:
  - **Nudge strip** (khi có `apps`): card `status==="applied"` với `days_since_applied > 7` → dòng nền `bg-amber-50` "⚠ {title} đã {n} ngày chưa cập nhật — hỏi AI cách follow-up nhé"; nút dismiss ghi `localStorage tp_nudge_dismiss = <YYYY-MM-DD hôm nay>`, cùng ngày không hiện lại.
  - **page="applications"**: nút "Tóm tắt pipeline" → `applicationsApi.aiSummary(token)`, render markdown-lite (tái dùng đúng pattern `escapeHtml` + bold-only của `AiInsightCard.tsx:11-25`), cache `sessionStorage tp_dock_summary` (JSON `{md, at}`).
  - **page="jobs"**: fetch `recommendationsApi.get(token)` lần đầu mount (cache `sessionStorage tp_dock_reco`); render: chips `target_roles`; dòng "Thị trường: {matching_jobs} job khớp · {matching_jobs_in_city} tại {cities[0]}"; hai list "Điểm mạnh" (`your_strengths`) / "Nên học" (`skill_gaps`); `narrative` bên dưới. Mọi field render phòng thủ (`?? []`, `?? "—"`). Lỗi → nút "Thử lại"; không ảnh hưởng tab Chat.
- [ ] **Step 2: Truyền vào 2 trang** — jobs: `insight={<DockInsight page="jobs"/>}`; applications: cần `apps` — nâng state `apps` + `load/changeStatus/remove` từ `Content` lên `ApplicationsPage` (giữ nguyên logic, chỉ dời chỗ khai báo), truyền xuống `Content` qua props và `insight={<DockInsight page="applications" apps={apps}/>}`.
- [ ] **Step 3: Verify tay** — tab Insight ở `/jobs` hiện career roadmap (endpoint mồ côi lần đầu có UI); `/applications` tóm tắt chạy; card applied >7 ngày hiện nudge; dismiss thì hết ngày mới hiện lại; lỗi mạng (chặn request bằng DevTools) → nút Thử lại.
- [ ] **Step 4: Typecheck + jest (không vỡ test Task 3/4) + commit**

```bash
cd apps/frontend && npx tsc --noEmit && npx jest components/copilot --no-coverage
git add apps/frontend/components/copilot/DockInsight.tsx apps/frontend/app/jobs/page.tsx apps/frontend/app/applications/page.tsx
git commit -m "feat(copilot): insight tab (recommendations + ai-summary) + nudge strip"
```

---

### Task 6: Backend — 2 agent tools thị trường (deal lương + soi công ty)

**Files:**
- Create: `apps/backend/app/services/agent/tools/market_tools.py`, `apps/backend/tests/test_agent/test_market_tools.py`
- Modify: `apps/backend/app/services/agent/chains/skill_advisor_chain.py` (thêm 2 tool vào `_BASE_TOOLS`)

**Interfaces:**
- Produces: 2 LangChain tools `get_salary_benchmark(job_level: str, city: str | None)` và `get_company_hiring(company_name: str)` — trả text tiếng Việt gọn cho LLM.

- [ ] **Step 1: Học pattern tool sẵn có** — đọc `apps/backend/app/services/agent/tools/skill_tools.py` và `job_search_tools.py` (decorator, cách lấy session/engine, format kết quả, error handling). **Dùng đúng pattern đó** — đây là chuẩn của repo, không tự chế.
- [ ] **Step 2: Đối chiếu schema mart** — mở `apps/backend/app/api/salary.py` và `apps/backend/app/api/companies.py`, copy đúng tên bảng/cột + công thức đơn vị (triệu VND) hai API này đang dùng. **API là chuẩn cột** — SQL dưới đây chỉ là khung ý định:

```sql
-- salary benchmark: dbt_dev_gold.mart_salary_by_level, lọc theo job_level (+city nếu có),
-- lấy p25/p50/p75 (đơn vị triệu như salary.py) + sample size nếu có cột.
-- company hiring: dbt_dev_gold.mart_company_hiring, WHERE company_name ILIKE :name LIMIT 5,
-- lấy jobs_posted / avg salary / city như companies.py.
```

- [ ] **Step 3: Test fail** — `tests/test_agent/test_market_tools.py` theo phong cách file test cạnh đó (đọc 1 file trong `tests/test_agent/` trước để lấy fixture pattern). Test hàm query thuần (không LLM): benchmark trả chuỗi chứa "P50"; company trả chuỗi chứa tên công ty; không có data → chuỗi "không có dữ liệu". Chạy fail trước.
- [ ] **Step 4: Implement `market_tools.py`** — 2 tools, docstring tiếng Anh ("Use when the user asks whether a salary/offer is good for a level/city" / "Use when the user asks about a company's hiring activity"), output vd: `"Mid-level @ HCMC: P25 18tr · P50 23tr · P75 28tr (n=142)"`. Chạy test pass (cách chạy pytest theo `apps/backend/tests/` conftest; DB dùng container postgres đang chạy).
- [ ] **Step 5: Thêm vào `_BASE_TOOLS`** trong `skill_advisor_chain.py` (import + 2 phần tử, không đổi gì khác).
- [ ] **Step 6: Nạp container + verify tay**

```bash
docker cp apps/backend/app/services/agent/tools/market_tools.py tp-backend:/app/app/services/agent/tools/market_tools.py
docker cp apps/backend/app/services/agent/chains/skill_advisor_chain.py tp-backend:/app/app/services/agent/chains/skill_advisor_chain.py
docker restart tp-backend && sleep 15 && docker logs tp-backend --tail 5
```

Dock chat: "offer 23 triệu cho Mid-level ở HCMC có ổn không?" → có percentile thật; "FPT Software tuyển ra sao?" → có số job.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/app/services/agent/tools/market_tools.py apps/backend/app/services/agent/chains/skill_advisor_chain.py apps/backend/tests/test_agent/test_market_tools.py
git commit -m "feat(agent): salary benchmark + company hiring tools cho copilot dock"
```

---

### Task 7: Regression flag-off + E2E checklist + chốt

**Files:** không file mới (trừ khi vá lỗi tìm thấy).

- [ ] **Step 1: Flag OFF regression** — dev KHÔNG set `NEXT_PUBLIC_COPILOT_DOCK`: `/jobs` + `/applications` giống hệt trước plan (không dock, không nút nổi; Kanban + nút Lưu/Đã apply — 2 feature còn uncommitted — vẫn hoạt động).
- [ ] **Step 2: Flag ON — E2E checklist** (browser, `uitest@example.com`):
  1. "tìm job python có lương" → filter đổi ✓
  2. "lưu job thứ 2" → card flip ✓; `/applications` thấy card ở Đã lưu ✓
  3. "chuyển nó sang phỏng vấn" → nhảy cột ✓ reload còn ✓
  4. "offer 25tr cho Mid-level HCMC ổn không?" → percentile ✓
  5. Tab Insight cả 2 trang ✓ nudge với card cũ ✓
  6. Collapse → F5 → còn collapse ✓; viewport 390px: nút nổi + sheet mở/đóng ✓
  7. Console: không error mới (baseline: 1 warning forwardRef cũ ở AddApplicationDialog).
- [ ] **Step 3: Fullcheck** — `cd apps/frontend && npx tsc --noEmit && npx jest components/copilot --no-coverage`.
- [ ] **Step 4: Dọn + báo cáo** — xoá application test thừa tạo lúc test (giữ user `uitest`); liệt kê mọi commit của plan; nhắc rõ: (a) deploy cần thêm `NEXT_PUBLIC_COPILOT_DOCK` vào compose/CI env — hiện CHƯA có ở đâu, bật là quyết định có chủ đích; (b) `NEXT_PUBLIC_AI_HOME` cũng chưa bật trên prod — dock độc lập nhưng cùng phụ thuộc route `/api/copilotkit` (route luôn tồn tại, không cần AI_HOME); (c) backend container đang chạy code `docker cp` — deploy thật phải rebuild image.

---

## Self-review (đã chạy khi viết)

- **Spec coverage:** §4 files ↔ Task 1-5; §6 ba actions ↔ Task 3-4 (không delete-tool ✓); §7 fit-scoring dùng profile-injection middleware sẵn có + context §5 (không cần task riêng), salary/company ↔ Task 6, so-sánh-job-đã-lưu chạy bằng context board Task 4; §8 ↔ Task 5; §9 threadId `dock-{userId}` ↔ Task 2; §10 flag ↔ Task 1 + Task 7; §11 error paths nằm trong handler các Task 3-5; §12 ↔ test từng task + Task 7; §14.1 ↔ Task 1 spike; §14.2 ↔ Task 6; §14.3 ↔ Task 7 step 4; §14.4 ↔ đã xác nhận `profile_injection.py` tồn tại (recon 2026-07-16).
- **Type consistency:** `DockTool`/`useDockTool` thống nhất Task 1→3→4; `TrackedKey {id, source, source_job_id, status}` khớp `lib/api.ts`; `changeStatus(id, status)`/`handleTracked` là hàm thật đang có trong 2 page.
- **Placeholder scan:** Task 6 SQL chủ đích ghi "API là chuẩn cột" kèm đường dẫn 2 file phải mở — chỉ dẫn hành động cụ thể, không TBD. Task 1 step 2 là bước khám phá có lệnh + tiêu chí dừng rõ.
