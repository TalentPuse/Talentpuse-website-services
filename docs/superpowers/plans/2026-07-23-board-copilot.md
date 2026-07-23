# Board Copilot v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dock AI bên phải `/applications` — điều khiển board bằng lời (chuyển cột, thêm job, ghi chú), đọc hiểu pipeline, và tra số liệu lương/công ty thật từ warehouse.

**Architecture:** CopilotKit v2 frontend-tools. Handler chạy trong browser, gọi đúng hàm UI sẵn có (`changeStatus`, `applicationsApi`) nên hành vi khớp 100% thao tác tay. Không thêm endpoint backend cho action; chỉ thêm 2 agent tool đọc warehouse. Spec: `docs/superpowers/specs/2026-07-23-board-copilot-design.md`.

**Tech Stack:** Next.js 14 App Router, `@copilotkit/react-core@1.62.3` (namespace v2), `zod@^3.25.76`, `sonner` (toast), `@dnd-kit`, Tailwind v4, Jest + RTL, FastAPI + LangChain.

## Global Constraints

- **Repo có 3 file hạ tầng Docker đang uncommitted không thuộc plan này** (`apps/frontend/Dockerfile`, `apps/frontend/.dockerignore`, `docker-compose.yml`). **TUYỆT ĐỐI không `git add .` / `git add -A`** — mỗi commit stage đúng path nêu trong task.
- Mọi lệnh frontend chạy trong `apps/frontend`. Gate mỗi task: `npx tsc --noEmit` exit 0 và `npm test` xanh.
- Flag `NEXT_PUBLIC_COPILOT_DOCK` — chỉ `"1"` là bật. **Flag tắt ⇒ `/applications` giữ nguyên hành vi hiện tại, zero regression.**
- **AI không được xoá application.** Không expose tool delete. (Undo của `add_application` do user bấm thì được — đó là hành động của user, không phải của AI.)
- Copy tiếng Việt, identifier tiếng Anh, brand viết **"TalentPuse"**.
- Token màu dùng bộ sẵn có: `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-text-muted`, `brand-*`, `ring-border`. Không thêm màu mới.
- **Chỉ `copilot-bridge.tsx` được import hook CopilotKit trực tiếp.** Mọi tool/context đi qua `useDockTool` / `useDockContext`.
- Status hợp lệ, đúng thứ tự cột: `saved · applied · interviewing · offer · rejected`.

---

## Interface đã có (đọc trước khi code — không đoán lại)

```ts
// components/copilot/copilot-bridge.tsx  (Task 1 của plan 16/07 — ĐÃ XONG)
export type DockToolParam = {
  name: string; type: "string" | "number" | "boolean";
  description: string; required?: boolean; enum?: string[];
};
export type DockTool = {
  name: string; description: string; parameters: DockToolParam[];
  handler: (args: Record<string, unknown>) => Promise<string>;
};
export function useDockTool(tool: DockTool): void;
export function useDockContext(description: string, value: unknown): void;

// components/copilot/CopilotDockProvider.tsx  (ĐÃ XONG)
// Flag tắt ⇒ trả về <>{children}</> (không render CopilotKit, không nạp CSS).
export default function CopilotDockProvider(props: {
  page: "jobs" | "applications"; insight?: React.ReactNode; children: React.ReactNode;
}): JSX.Element;

// lib/api.ts  (ĐÃ CÓ)
export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";
export type Application = {
  id: string; source: string; source_job_id: string | null; title: string;
  company_name: string | null; city: string | null; source_url: string | null;
  salary_million: number | null; status: ApplicationStatus; applied_at: string | null;
  notes: string | null; created_at: string;
};
export type ApplicationStats = { total: number; by_status: Record<ApplicationStatus, number>; applied_this_week: number };
export type CreateApplicationBody =
  | { source: string; source_job_id: string; status?: ApplicationStatus }
  | { title: string; company_name?: string; city?: string; source_url?: string;
      salary_million?: number; status?: ApplicationStatus; applied_at?: string; notes?: string };
applicationsApi.list(token, opts?)   // => { applications, total, page, per_page }
applicationsApi.stats(token)         // => ApplicationStats
applicationsApi.create(token, body)  // => Application  (backend: source = body.source || "manual")
applicationsApi.update(token, id, { status?, notes?, applied_at? })  // => Application
applicationsApi.remove(token, id)
```

**Ràng buộc React quan trọng:** `BoardCopilot` gọi hook của CopilotKit nên **chỉ được render khi flag bật** (`{COPILOT_DOCK && <BoardCopilot …/>}`). Đây là render có điều kiện của cả component — hợp lệ; không phải gọi hook có điều kiện.

---

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `components/copilot/resolve-card.ts` | tạo | Pure: tên/id → card. Không import React. |
| `components/copilot/__tests__/resolve-card.test.ts` | tạo | Unit cho trên |
| `components/copilot/undo-toast.ts` | tạo | Hiện toast kèm nút Hoàn tác 8s |
| `app/applications/use-board-data.ts` | tạo | Hook sở hữu fetch + mutation của board |
| `components/copilot/BoardCopilot.tsx` | tạo | null-render: 1 context + 3 tool |
| `components/copilot/__tests__/board-copilot.test.tsx` | tạo | Unit handler |
| `components/copilot/insight-stats.ts` | tạo | Pure: tính nudge/phễu/chẩn đoán từ `Application[]` |
| `components/copilot/__tests__/insight-stats.test.ts` | tạo | Unit cho trên |
| `components/copilot/DockInsight.tsx` | tạo | Nudge + tỉ lệ chuyển đổi + tóm tắt |
| `app/applications/page.tsx` | sửa | Hoist state, bọc provider, render BoardCopilot |
| `components/applications/BoardColumn.tsx` | sửa | `2xl:min-w-0` → `2xl:min-w-[260px]` |
| `components/applications/ApplicationBoard.tsx` | sửa | bỏ `2xl:overflow-x-visible` |
| `apps/backend/app/services/agent/tools/market_tools.py` | tạo | `salary_benchmark`, `company_hiring` |
| `apps/backend/app/services/agent/chains/skill_advisor_chain.py` | sửa | thêm 2 tool vào `_BASE_TOOLS` |
| `apps/backend/tests/test_agent/test_market_tools.py` | tạo | Unit backend |

Lý do tách `use-board-data.ts`: `CopilotDockProvider` nhận `insight` như prop **bên ngoài** `children`, nên `DockInsight` không thể đọc state nằm trong `Content`. Hoisting state lên `ApplicationsPage` là cách duy nhất để cả `Content` lẫn `DockInsight` cùng đọc một nguồn, và tiện thể giữ `page.tsx` gọn.

---

### Task 1: `resolve-card` — khử nhập nhằng tên → card

Pure function, không phụ thuộc React hay mạng, nên làm trước và test kỹ. Mọi tool ở Task 2–3 dựa vào nó.

**Files:**
- Create: `apps/frontend/components/copilot/resolve-card.ts`
- Test: `apps/frontend/components/copilot/__tests__/resolve-card.test.ts`

**Interfaces:**
- Consumes: `Application` từ `@/lib/api`
- Produces:
```ts
export type ResolveResult =
  | { ok: true; card: Application }
  | { ok: false; reason: "not_found"; candidates: [] }
  | { ok: false; reason: "ambiguous"; candidates: Application[] };
export function resolveCard(apps: Application[], query: string): ResolveResult;
export function describeCandidates(candidates: Application[]): string;
```

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/frontend/components/copilot/__tests__/resolve-card.test.ts`:

```ts
import { resolveCard, describeCandidates } from "../resolve-card";
import type { Application } from "@/lib/api";

function app(over: Partial<Application>): Application {
  return {
    id: "id-1", source: "linkedin", source_job_id: null, title: "Data Analyst",
    company_name: "SUNJIN", city: "HCMC", source_url: null, salary_million: null,
    status: "applied", applied_at: null, notes: null, created_at: "2026-07-01T00:00:00",
    ...over,
  };
}

describe("resolveCard", () => {
  it("khớp id chính xác", () => {
    const apps = [app({ id: "a" }), app({ id: "b", title: "AI Engineer" })];
    const r = resolveCard(apps, "b");
    expect(r).toEqual({ ok: true, card: apps[1] });
  });

  it("khớp title chính xác, bỏ qua hoa thường và khoảng trắng thừa", () => {
    const apps = [app({ id: "a", title: "AI Engineer" }), app({ id: "b", title: "Data Engineer" })];
    const r = resolveCard(apps, "  ai engineer ");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("ưu tiên khớp chính xác hơn khớp chứa", () => {
    const apps = [app({ id: "a", title: "Data Engineer" }), app({ id: "b", title: "Senior Data Engineer" })];
    const r = resolveCard(apps, "Data Engineer");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("khớp chứa khi chỉ có một ứng viên", () => {
    const apps = [app({ id: "a", title: "AI ＆DATA Scientist/Databricks" }), app({ id: "b", title: "Business Analyst" })];
    const r = resolveCard(apps, "databricks");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("trả ambiguous kèm candidates khi nhiều card cùng khớp chứa", () => {
    const apps = [app({ id: "a", title: "Data Analyst" }), app({ id: "b", title: "Data Engineer" })];
    const r = resolveCard(apps, "data");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("ambiguous");
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("trả not_found khi không khớp gì", () => {
    const r = resolveCard([app({})], "kubernetes");
    expect(r).toEqual({ ok: false, reason: "not_found", candidates: [] });
  });

  it("trả not_found với query rỗng", () => {
    const r = resolveCard([app({})], "   ");
    expect(r).toEqual({ ok: false, reason: "not_found", candidates: [] });
  });

  it("describeCandidates liệt kê tên + công ty + trạng thái", () => {
    const out = describeCandidates([app({ id: "a", title: "Data Analyst", company_name: "SUNJIN", status: "applied" })]);
    expect(out).toContain("Data Analyst");
    expect(out).toContain("SUNJIN");
    expect(out).toContain("applied");
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/resolve-card.test.ts
```
Expected: FAIL — `Cannot find module '../resolve-card'`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `apps/frontend/components/copilot/resolve-card.ts`:

```ts
import type { Application } from "@/lib/api";

/**
 * Tên card → card, dùng cho mọi tool ghi dữ liệu của dock.
 *
 * Thứ tự khớp là cố ý: id → title chính xác → title chứa. Bước "chứa" chỉ
 * được dùng khi CHỈ CÓ MỘT ứng viên; ≥2 thì trả `ambiguous` để AI hỏi lại.
 * Đoán bừa ở đây nghĩa là chuyển nhầm cột một job mà user không hề biết mình
 * vừa mất dấu thứ gì — đắt hơn nhiều so với việc hỏi thêm một câu.
 */
export type ResolveResult =
  | { ok: true; card: Application }
  | { ok: false; reason: "not_found"; candidates: [] }
  | { ok: false; reason: "ambiguous"; candidates: Application[] };

const NOT_FOUND: ResolveResult = { ok: false, reason: "not_found", candidates: [] };

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function resolveCard(apps: Application[], query: string): ResolveResult {
  const q = norm(query);
  if (!q) return NOT_FOUND;

  const byId = apps.find((a) => a.id === query.trim());
  if (byId) return { ok: true, card: byId };

  const exact = apps.filter((a) => norm(a.title) === q);
  if (exact.length === 1) return { ok: true, card: exact[0] };
  if (exact.length > 1) return { ok: false, reason: "ambiguous", candidates: exact };

  const partial = apps.filter((a) => norm(a.title).includes(q));
  if (partial.length === 1) return { ok: true, card: partial[0] };
  if (partial.length > 1) return { ok: false, reason: "ambiguous", candidates: partial };

  return NOT_FOUND;
}

/** Một dòng cho mỗi ứng viên, đủ để AI hỏi lại user chọn cái nào. */
export function describeCandidates(candidates: Application[]): string {
  return candidates
    .map((c) => `- "${c.title}"${c.company_name ? ` tại ${c.company_name}` : ""} (${c.status}, id=${c.id})`)
    .join("\n");
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/resolve-card.test.ts
```
Expected: PASS, 8 tests

- [ ] **Step 5: Typecheck**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: exit 0, không output

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components/copilot/resolve-card.ts apps/frontend/components/copilot/__tests__/resolve-card.test.ts
git commit -m "feat(copilot): resolve-card khu nhap nhang ten card"
```

---

### Task 2: Hoist board state + `move_application` + bố cục — dock chạy end-to-end

Task lớn nhất vì đây là lần đầu dock thực sự hiện ra. Gộp cả refactor state, mount, sửa layout và tool đầu tiên: reviewer không thể duyệt riêng phần nào trong đó — thiếu một mảnh là dock không chạy.

**Files:**
- Create: `apps/frontend/components/copilot/undo-toast.ts`
- Create: `apps/frontend/app/applications/use-board-data.ts`
- Create: `apps/frontend/components/copilot/BoardCopilot.tsx`
- Test: `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`
- Modify: `apps/frontend/app/applications/page.tsx`
- Modify: `apps/frontend/components/applications/BoardColumn.tsx:40`
- Modify: `apps/frontend/components/applications/ApplicationBoard.tsx` (dòng có `2xl:overflow-x-visible`)

**Interfaces:**
- Consumes: `resolveCard`, `describeCandidates` (Task 1); `useDockTool`, `useDockContext` (bridge)
- Produces:
```ts
// undo-toast.ts
export function toastWithUndo(message: string, undo: () => Promise<void> | void): void;

// use-board-data.ts
export type BoardData = {
  apps: Application[]; stats: ApplicationStats | null; loading: boolean;
  token: string | null;
  reload: () => Promise<void>;
  changeStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
export function useBoardData(): BoardData;

// BoardCopilot.tsx
export default function BoardCopilot(props: { board: BoardData }): null;
```

- [ ] **Step 1: Viết `undo-toast.ts`**

Tạo `apps/frontend/components/copilot/undo-toast.ts`:

```ts
import { toast } from "sonner";

/**
 * Toast kèm nút Hoàn tác 8 giây. Đây là thứ THAY CHO bước hỏi-xác-nhận:
 * mọi thao tác ghi của AI chạy ngay, nhưng luôn có đường lùi trong tầm tay.
 * Hỏi trước mỗi lần sẽ giết cảm giác điều khiển bằng lời — nói xong vẫn phải
 * bấm thì chẳng nhanh hơn tự kéo.
 */
export function toastWithUndo(message: string, undo: () => Promise<void> | void): void {
  toast.success(message, {
    duration: 8000,
    action: {
      label: "Hoàn tác",
      onClick: () => {
        void (async () => {
          try {
            await undo();
            toast.success("Đã hoàn tác");
          } catch {
            toast.error("Không hoàn tác được");
          }
        })();
      },
    },
  });
}
```

- [ ] **Step 2: Tách `use-board-data.ts` (bê nguyên logic đang có trong `page.tsx`)**

Tạo `apps/frontend/app/applications/use-board-data.ts`:

```ts
"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi, type Application, type ApplicationStats, type ApplicationStatus } from "@/lib/api";

/**
 * Sở hữu toàn bộ dữ liệu + mutation của board.
 *
 * State phải nằm ở page chứ không trong `Content` vì `CopilotDockProvider`
 * nhận `insight` như một prop NGOÀI `children` — `DockInsight` không thể đọc
 * state nằm bên trong `Content`. Hoisting là cách duy nhất để board và dock
 * cùng nhìn một nguồn dữ liệu.
 */
export type BoardData = {
  apps: Application[];
  stats: ApplicationStats | null;
  loading: boolean;
  token: string | null;
  reload: () => Promise<void>;
  changeStatus: (id: string, status: ApplicationStatus) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export function useBoardData(): BoardData {
  const { token } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [list, s] = await Promise.all([applicationsApi.list(token), applicationsApi.stats(token)]);
      setApps(list.applications);
      setStats(s);
    } catch {
      toast.error("Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Thả card sang cột khác vào đây. Optimistic, rollback khi lỗi. */
  const changeStatus = useCallback(
    async (id: string, status: ApplicationStatus) => {
      if (!token) return;
      const prev = apps;
      setApps((xs) => xs.map((a) => (a.id === id ? { ...a, status } : a)));
      try {
        await applicationsApi.update(token, id, { status });
        await reload();
      } catch {
        setApps(prev);
        toast.error("Không đổi được trạng thái");
        // Ném tiếp để handler của copilot biết mà báo lại cho AI thay vì
        // im lặng khẳng định đã chuyển xong.
        throw new Error("update_failed");
      }
    },
    [token, apps, reload],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) return;
      const prev = apps;
      setApps((xs) => xs.filter((a) => a.id !== id));
      try {
        await applicationsApi.remove(token, id);
        await reload();
      } catch {
        setApps(prev);
        toast.error("Không xoá được");
      }
    },
    [token, apps, reload],
  );

  return { apps, stats, loading, token, reload, changeStatus, remove };
}
```

- [ ] **Step 3: Viết test thất bại cho `BoardCopilot`**

Tạo `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import BoardCopilot from "../BoardCopilot";
import type { BoardData } from "@/app/applications/use-board-data";
import type { Application } from "@/lib/api";

const registered = new Map<string, (a: Record<string, unknown>) => Promise<string>>();
jest.mock("../copilot-bridge", () => ({
  useDockTool: (tool: { name: string; handler: (a: Record<string, unknown>) => Promise<string> }) => {
    registered.set(tool.name, tool.handler);
  },
  useDockContext: () => undefined,
}));
jest.mock("../undo-toast", () => ({ toastWithUndo: jest.fn() }));

function app(over: Partial<Application>): Application {
  return {
    id: "id-1", source: "linkedin", source_job_id: null, title: "Data Analyst",
    company_name: "SUNJIN", city: "HCMC", source_url: null, salary_million: null,
    status: "applied", applied_at: null, notes: null, created_at: "2026-07-01T00:00:00",
    ...over,
  };
}

function board(over: Partial<BoardData> = {}): BoardData {
  return {
    apps: [app({ id: "a", title: "Data Analyst" }), app({ id: "b", title: "AI Engineer" })],
    stats: null, loading: false, token: "tok",
    reload: jest.fn().mockResolvedValue(undefined),
    changeStatus: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("BoardCopilot / move_application", () => {
  beforeEach(() => registered.clear());

  it("gọi changeStatus với đúng id khi tên khớp", async () => {
    const b = board();
    render(<BoardCopilot board={b} />);
    const out = await registered.get("move_application")!({ card: "AI Engineer", status: "interviewing" });
    expect(b.changeStatus).toHaveBeenCalledWith("b", "interviewing");
    expect(out).toContain("AI Engineer");
  });

  it("KHÔNG gọi changeStatus khi tên nhập nhằng, trả candidates", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" }), app({ id: "b", title: "Data Engineer" })] });
    render(<BoardCopilot board={b} />);
    const out = await registered.get("move_application")!({ card: "data", status: "offer" });
    expect(b.changeStatus).not.toHaveBeenCalled();
    expect(out).toContain("Data Analyst");
    expect(out).toContain("Data Engineer");
  });

  it("KHÔNG gọi changeStatus khi không tìm thấy card", async () => {
    const b = board();
    render(<BoardCopilot board={b} />);
    const out = await registered.get("move_application")!({ card: "kubernetes", status: "offer" });
    expect(b.changeStatus).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("không tìm thấy");
  });

  it("không đăng ký tool xoá", () => {
    render(<BoardCopilot board={board()} />);
    expect([...registered.keys()].some((k) => /delete|remove/.test(k))).toBe(false);
  });
});
```

- [ ] **Step 4: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/board-copilot.test.tsx
```
Expected: FAIL — `Cannot find module '../BoardCopilot'`

- [ ] **Step 5: Viết `BoardCopilot.tsx` (chỉ `move_application` ở task này)**

Tạo `apps/frontend/components/copilot/BoardCopilot.tsx`:

```tsx
"use client";
import type { BoardData } from "@/app/applications/use-board-data";
import type { ApplicationStatus } from "@/lib/api";
import { useDockContext, useDockTool } from "./copilot-bridge";
import { describeCandidates, resolveCard } from "./resolve-card";
import { toastWithUndo } from "./undo-toast";

const STATUSES: ApplicationStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Null-render: chỉ đăng ký context + tool cho agent, không vẽ gì.
 *
 * CHỈ được render khi `COPILOT_DOCK` bật — nó gọi hook của CopilotKit nên
 * phải nằm trong `<CopilotKit>` mà CopilotDockProvider chỉ dựng khi flag bật.
 */
export default function BoardCopilot({ board }: { board: BoardData }): null {
  const { apps, changeStatus } = board;

  useDockContext(
    "Bảng ứng tuyển của user trên trang /applications: đếm theo cột và danh sách card đang hiển thị.",
    {
      counts: STATUSES.reduce<Record<string, number>>((acc, s) => {
        acc[s] = apps.filter((a) => a.status === s).length;
        return acc;
      }, {}),
      cards: apps.map((a) => ({
        id: a.id, title: a.title, company: a.company_name, status: a.status,
        city: a.city, salary_million: a.salary_million, source: a.source,
        applied_at: a.applied_at, days_since_applied: daysSince(a.applied_at),
      })),
    },
  );

  useDockTool({
    name: "move_application",
    description:
      "Move one job application card to a different status column on the board. " +
      "Use when the user says a job moved forward or backward in their pipeline " +
      "(e.g. got an interview, got an offer, was rejected).",
    parameters: [
      { name: "card", type: "string", required: true,
        description: "Job title of the card to move, or its exact id from context." },
      { name: "status", type: "string", required: true, enum: STATUSES,
        description: "Target column." },
    ],
    handler: async (args) => {
      const query = String(args.card ?? "");
      const status = String(args.status ?? "") as ApplicationStatus;
      if (!STATUSES.includes(status)) return `Trạng thái "${status}" không hợp lệ.`;

      const found = resolveCard(apps, query);
      if (!found.ok) {
        return found.reason === "not_found"
          ? `Không tìm thấy card nào khớp "${query}". Hỏi user xem họ muốn nói job nào.`
          : `Có nhiều card khớp "${query}", hỏi lại user chọn cái nào:\n${describeCandidates(found.candidates)}`;
      }

      const card = found.card;
      if (card.status === status) return `"${card.title}" đã ở cột ${status} rồi.`;

      const previous = card.status;
      try {
        await changeStatus(card.id, status);
      } catch {
        return `Không đổi được trạng thái của "${card.title}" — API lỗi. Báo user thử lại.`;
      }
      toastWithUndo(`Đã chuyển "${card.title}" sang ${status}`, () => changeStatus(card.id, previous));
      return `Đã chuyển "${card.title}" từ ${previous} sang ${status}.`;
    },
  });

  return null;
}
```

- [ ] **Step 6: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/board-copilot.test.tsx
```
Expected: PASS, 4 tests

- [ ] **Step 7: Sửa `page.tsx` — hoist state, bọc provider, mount BoardCopilot**

Thay toàn bộ `apps/frontend/app/applications/page.tsx` bằng:

```tsx
"use client";
import { ClipboardCheck } from "@/lib/icons";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ForceTheme } from "@/components/theme/ForceTheme";
import { Skeleton } from "@/components/ui/skeleton";
import ApplicationBoard from "@/components/applications/ApplicationBoard";
import AddApplicationDialog from "@/components/applications/AddApplicationDialog";
import CopilotDockProvider from "@/components/copilot/CopilotDockProvider";
import BoardCopilot from "@/components/copilot/BoardCopilot";
import { COPILOT_DOCK } from "@/lib/flags";
import type { ApplicationStatus } from "@/lib/api";
import { useBoardData, type BoardData } from "./use-board-data";

export default function ApplicationsPage() {
  const board = useBoardData();
  return (
    <DashboardLayout>
      <ForceTheme theme="light" />
      <CopilotDockProvider page="applications">
        <Content board={board} />
      </CopilotDockProvider>
    </DashboardLayout>
  );
}

function Content({ board }: { board: BoardData }) {
  const { apps, stats, loading, reload, changeStatus, remove } = board;

  // `changeStatus` ném lỗi để handler của copilot biết mà báo lại cho AI, nhưng
  // `ApplicationBoard.handleDragEnd` gọi nó không await/catch — ném thẳng lên đó
  // sẽ thành unhandled rejection mỗi lần kéo-thả gặp lỗi mạng. Nuốt ở đúng biên
  // này: người kéo đã thấy toast lỗi + card rollback rồi, không cần gì thêm.
  const dragStatusChange = (id: string, status: ApplicationStatus) =>
    changeStatus(id, status).catch(() => undefined);

  return (
    // Wide cap: 5 × 288px tracks + gaps need ~1500px. max-w-7xl (1280px) forced a
    // horizontal scrollbar even on a 1920px screen that had room to spare.
    // h-full + flex-col lets the board claim the leftover height (AppShell's
    // <main> is flex-1 in an h-screen column), so columns scroll internally the
    // way a board should instead of leaving a void under a stubby row of cards.
    <div className="mx-auto flex h-full max-w-[1600px] flex-col p-6">
      {/* Chỉ render khi flag bật: component này gọi hook CopilotKit nên phải
          nằm trong <CopilotKit>, mà provider chỉ dựng <CopilotKit> khi flag bật. */}
      {COPILOT_DOCK && <BoardCopilot board={board} />}

      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">Ứng tuyển</h1>
          {stats && <p className="text-sm text-text-muted">Đã apply {stats.by_status.applied} · Phỏng vấn {stats.by_status.interviewing} · Offer {stats.by_status.offer}</p>}
        </div>
        <AddApplicationDialog onCreated={() => void reload()} />
      </div>

      {loading ? (
        <div className="flex min-h-0 flex-1 gap-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="w-72 shrink-0 rounded-2xl 2xl:w-auto 2xl:flex-1" />)}</div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center">
          <ClipboardCheck className="h-10 w-10 text-text-muted/50" strokeWidth={1.5} />
          <p className="text-text-muted">Chưa có job nào. Bấm <b>&quot;Lưu&quot;</b> hoặc <b>&quot;Đã apply&quot;</b> ở trang Việc làm/Alerts, hoặc <b>Thêm job đã apply</b>.</p>
        </div>
      ) : (
        <>
          <p className="mb-2 shrink-0 text-xs text-text-muted">Kéo card sang cột khác để đổi trạng thái, hoặc bảo trợ lý AI bên phải làm hộ.</p>
          <div className="min-h-0 flex-1">
            <ApplicationBoard apps={apps} onStatusChange={dragStatusChange} onDelete={remove} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Sửa bố cục — cột không được co dưới 260px**

Trong `apps/frontend/components/applications/BoardColumn.tsx` dòng 40, đổi:

```
      className="flex w-72 shrink-0 snap-start flex-col 2xl:w-auto 2xl:min-w-0 2xl:flex-1 2xl:shrink"
```
thành:
```
      className="flex w-72 shrink-0 snap-start flex-col 2xl:w-auto 2xl:min-w-[260px] 2xl:flex-1 2xl:shrink"
```

Trong `apps/frontend/components/applications/ApplicationBoard.tsx`, đổi dòng className của div board:

```
          "flex h-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2 2xl:overflow-x-visible",
```
thành:
```
          "flex h-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2",
```

và thay comment ngay phía trên khối đó bằng:

```tsx
      {/* Fixed-width tracks + horizontal scroll; from 2xl the columns flex to fill
          but never below 260px. `2xl:overflow-x-visible` bị bỏ vì với dock 380px
          mở ra, ngay cả màn 1920 cũng chỉ còn ~1250px cho 5 cột — flex tự do sẽ
          bóp cột xuống ~236px, tên job xuống 3 dòng. Giữ min-width rồi cho cuộn
          là đánh đổi đúng: thà cuộn ngang còn hơn vỡ card. */}
```

- [ ] **Step 9: Typecheck + toàn bộ test**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; jest tất cả suite PASS

- [ ] **Step 10: Verify bằng mắt**

```bash
cd /d/TalentPulse/talentpulse && NEXT_PUBLIC_AI_HOME=1 NEXT_PUBLIC_COPILOT_DOCK=1 docker compose build frontend && docker compose up -d --no-build frontend
```
Mở `http://localhost:8002/applications`, đăng nhập `uitest@example.com` / `TestWorkflow123!`. Expected:
- Dock hiện bên phải, board đẩy sang trái, 5 cột vẫn đọc được.
- Gõ "chuyển Business Analyst sang phỏng vấn" → card nhảy cột, toast có nút **Hoàn tác**, F5 vẫn ở cột mới.
- Gõ "chuyển data sang offer" (nhập nhằng) → AI hỏi lại chứ không tự chọn.

- [ ] **Step 11: Commit**

```bash
git add apps/frontend/components/copilot/undo-toast.ts \
        apps/frontend/app/applications/use-board-data.ts \
        apps/frontend/components/copilot/BoardCopilot.tsx \
        apps/frontend/components/copilot/__tests__/board-copilot.test.tsx \
        apps/frontend/app/applications/page.tsx \
        apps/frontend/components/applications/BoardColumn.tsx \
        apps/frontend/components/applications/ApplicationBoard.tsx
git commit -m "feat(copilot): dock tren /applications + move_application"
```

---

### Task 3: `add_application` + `append_note`

**Files:**
- Modify: `apps/frontend/components/copilot/BoardCopilot.tsx`
- Modify: `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`

**Interfaces:**
- Consumes: `BoardData` (Task 2), `resolveCard`/`describeCandidates` (Task 1), `applicationsApi` từ `@/lib/api`
- Produces: hai tool `add_application`, `append_note` đăng ký trong cùng `BoardCopilot`

- [ ] **Step 1: Thêm test thất bại**

Thêm mock `@/lib/api` ngay dưới các `jest.mock` đang có ở đầu `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`:

```tsx
jest.mock("@/lib/api", () => ({
  applicationsApi: {
    create: jest.fn().mockResolvedValue({ id: "new-1", title: "AI Engineer" }),
    update: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue({}),
  },
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applicationsApi } = require("@/lib/api") as {
  applicationsApi: { create: jest.Mock; update: jest.Mock; remove: jest.Mock };
};
```

và thêm vào cuối file:

```tsx
describe("BoardCopilot / add_application", () => {
  beforeEach(() => { registered.clear(); jest.clearAllMocks(); });

  it("tạo card qua applicationsApi.create rồi reload", async () => {
    const b = board();
    render(<BoardCopilot board={b} />);
    await registered.get("add_application")!({ title: "AI Engineer", company: "VNG", status: "applied" });
    expect(applicationsApi.create).toHaveBeenCalledWith(
      "tok",
      expect.objectContaining({ title: "AI Engineer", company_name: "VNG", status: "applied" }),
    );
    expect(b.reload).toHaveBeenCalled();
  });

  it("từ chối khi thiếu title", async () => {
    render(<BoardCopilot board={board()} />);
    const out = await registered.get("add_application")!({ status: "applied" });
    expect(applicationsApi.create).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("tên job");
  });
});

describe("BoardCopilot / append_note", () => {
  beforeEach(() => { registered.clear(); jest.clearAllMocks(); });

  it("NỐI THÊM vào notes cũ, không đè", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: "ghi chú cũ" })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "HR hẹn vòng 2" });
    const patch = applicationsApi.update.mock.calls[0][2];
    expect(patch.notes.startsWith("ghi chú cũ")).toBe(true);
    expect(patch.notes).toContain("HR hẹn vòng 2");
  });

  it("tạo notes mới khi card chưa có ghi chú", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: null })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "gửi follow-up" });
    expect(applicationsApi.update.mock.calls[0][2].notes).toContain("gửi follow-up");
  });

  it("không ghi gì khi tên card nhập nhằng", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" }), app({ id: "b", title: "Data Engineer" })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "data", note: "x" });
    expect(applicationsApi.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/board-copilot.test.tsx
```
Expected: FAIL — `registered.get("add_application") is not a function`

- [ ] **Step 3: Implement hai tool**

Trong `apps/frontend/components/copilot/BoardCopilot.tsx`, thêm import:

```tsx
import { applicationsApi } from "@/lib/api";
```

Thêm helper ngay dưới `daysSince`:

```tsx
/** Tem ngày `[DD/MM]` đứng đầu mỗi dòng ghi chú AI thêm vào. */
function noteStamp(): string {
  const d = new Date();
  return `[${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}]`;
}
```

Thêm hai `useDockTool` ngay sau `move_application`, trước `return null`:

```tsx
  useDockTool({
    name: "add_application",
    description:
      "Add a new job application card for a job the user says they applied to " +
      "or saved, when that job is not already on the board. Only use for jobs " +
      "the user describes; never invent a job.",
    parameters: [
      { name: "title", type: "string", required: true, description: "Job title." },
      { name: "company", type: "string", description: "Company name." },
      { name: "city", type: "string", description: "City." },
      { name: "salary_million", type: "number", description: "Monthly salary in million VND." },
      { name: "status", type: "string", enum: STATUSES, description: "Column to put it in. Default applied." },
      { name: "applied_at", type: "string", description: "Date applied, YYYY-MM-DD." },
      { name: "source_url", type: "string", description: "Link to the job posting." },
    ],
    handler: async (args) => {
      const title = String(args.title ?? "").trim();
      if (!title) return "Thiếu tên job — hỏi user job đó tên gì.";
      if (!board.token) return "Chưa đăng nhập, không thêm được.";

      const status = STATUSES.includes(String(args.status) as ApplicationStatus)
        ? (String(args.status) as ApplicationStatus)
        : "applied";

      // Không truyền source/source_job_id ⇒ backend đặt source = "manual" và
      // source_job_id = NULL. Partial unique index (user_id, source,
      // source_job_id) WHERE source_job_id IS NOT NULL nên card thêm bằng lời
      // không bao giờ đụng constraint, cũng không gộp nhầm với card từ job board.
      try {
        const created = await applicationsApi.create(board.token, {
          title,
          company_name: args.company ? String(args.company) : undefined,
          city: args.city ? String(args.city) : undefined,
          salary_million: typeof args.salary_million === "number" ? args.salary_million : undefined,
          source_url: args.source_url ? String(args.source_url) : undefined,
          applied_at: args.applied_at ? String(args.applied_at) : undefined,
          status,
        });
        await board.reload();
        toastWithUndo(`Đã thêm "${title}"`, async () => {
          if (!board.token) return;
          await applicationsApi.remove(board.token, created.id);
          await board.reload();
        });
        return `Đã thêm "${title}" vào cột ${status}.`;
      } catch {
        return `Không thêm được "${title}" — API lỗi. Báo user thử lại.`;
      }
    },
  });

  useDockTool({
    name: "append_note",
    description:
      "Append a short note to a job application card — interview dates, recruiter " +
      "names, next steps. Notes are appended, never replaced.",
    parameters: [
      { name: "card", type: "string", required: true, description: "Job title of the card, or its id." },
      { name: "note", type: "string", required: true, description: "The note text to append." },
    ],
    handler: async (args) => {
      const query = String(args.card ?? "");
      const note = String(args.note ?? "").trim();
      if (!note) return "Ghi chú rỗng, không có gì để lưu.";
      if (!board.token) return "Chưa đăng nhập, không ghi được.";

      const found = resolveCard(apps, query);
      if (!found.ok) {
        return found.reason === "not_found"
          ? `Không tìm thấy card nào khớp "${query}".`
          : `Có nhiều card khớp "${query}", hỏi lại user:\n${describeCandidates(found.candidates)}`;
      }

      const card = found.card;
      const previous = card.notes;
      // NỐI THÊM, không đè: ghi chú user tự viết là dữ liệu không tái tạo được.
      const next = previous ? `${previous}\n${noteStamp()} ${note}` : `${noteStamp()} ${note}`;
      try {
        await applicationsApi.update(board.token, card.id, { notes: next });
        await board.reload();
      } catch {
        return `Không lưu được ghi chú cho "${card.title}" — API lỗi.`;
      }
      toastWithUndo(`Đã ghi chú vào "${card.title}"`, async () => {
        if (!board.token) return;
        await applicationsApi.update(board.token, card.id, { notes: previous ?? "" });
        await board.reload();
      });
      return `Đã thêm ghi chú vào "${card.title}".`;
    },
  });
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/board-copilot.test.tsx
```
Expected: PASS, 9 tests

- [ ] **Step 5: Typecheck**

```bash
cd apps/frontend && npx tsc --noEmit
```
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/components/copilot/BoardCopilot.tsx \
        apps/frontend/components/copilot/__tests__/board-copilot.test.tsx
git commit -m "feat(copilot): add_application + append_note (noi them, khong de)"
```

---

### Task 4: Insight tab — nudge, tỉ lệ chuyển đổi, tóm tắt

Tách phần tính toán thuần ra `insight-stats.ts` để test không cần render, và để rõ ràng rằng hai khối đầu **không gọi LLM**.

**Files:**
- Create: `apps/frontend/components/copilot/insight-stats.ts`
- Test: `apps/frontend/components/copilot/__tests__/insight-stats.test.ts`
- Create: `apps/frontend/components/copilot/DockInsight.tsx`
- Modify: `apps/frontend/app/applications/page.tsx`
- Modify: `apps/frontend/lib/api.ts` (chỉ khi `aiSummary` chưa tồn tại — xem Step 6)

**Interfaces:**
- Consumes: `Application` từ `@/lib/api`, `BoardData` (Task 2)
- Produces:
```ts
export type StaleCard = { id: string; title: string; days: number };
export type SourceStat = { source: string; total: number; interviewPlus: number };
export function findStaleApplied(apps: Application[], today?: Date): StaleCard[];
export function sourceBreakdown(apps: Application[]): SourceStat[];
export function funnelDiagnosis(apps: Application[]): string | null;
export default function DockInsight(props: { board: BoardData }): JSX.Element;
```

- [ ] **Step 1: Viết test thất bại**

Tạo `apps/frontend/components/copilot/__tests__/insight-stats.test.ts`:

```ts
import { findStaleApplied, sourceBreakdown, funnelDiagnosis } from "../insight-stats";
import type { Application } from "@/lib/api";

function app(over: Partial<Application>): Application {
  return {
    id: "id-1", source: "linkedin", source_job_id: null, title: "Data Analyst",
    company_name: null, city: null, source_url: null, salary_million: null,
    status: "applied", applied_at: "2026-07-01", notes: null, created_at: "2026-07-01T00:00:00",
    ...over,
  };
}
const TODAY = new Date("2026-07-23T00:00:00Z");

describe("findStaleApplied", () => {
  it("chỉ lấy status applied quá 7 ngày", () => {
    const apps = [
      app({ id: "old", applied_at: "2026-07-01" }),
      app({ id: "fresh", applied_at: "2026-07-22" }),
      app({ id: "other-col", applied_at: "2026-07-01", status: "offer" }),
    ];
    expect(findStaleApplied(apps, TODAY).map((s) => s.id)).toEqual(["old"]);
  });

  it("bỏ qua card không có applied_at", () => {
    expect(findStaleApplied([app({ applied_at: null })], TODAY)).toEqual([]);
  });

  it("sắp xếp cũ nhất trước", () => {
    const apps = [app({ id: "a", applied_at: "2026-07-10" }), app({ id: "b", applied_at: "2026-07-01" })];
    expect(findStaleApplied(apps, TODAY).map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("sourceBreakdown", () => {
  it("đếm tổng và số card đã tới interviewing trở lên theo nguồn", () => {
    const apps = [
      app({ source: "linkedin", status: "applied" }),
      app({ source: "linkedin", status: "interviewing" }),
      app({ source: "vietnamworks", status: "offer" }),
    ];
    expect(sourceBreakdown(apps)).toEqual([
      { source: "linkedin", total: 2, interviewPlus: 1 },
      { source: "vietnamworks", total: 1, interviewPlus: 1 },
    ]);
  });
});

describe("funnelDiagnosis", () => {
  it("cảnh báo khi >= 8 applied mà chưa có phỏng vấn nào", () => {
    const apps = Array.from({ length: 8 }, (_, i) => app({ id: `a${i}`, status: "applied" }));
    expect(funnelDiagnosis(apps)).toContain("CV");
  });

  it("im lặng khi đã có phỏng vấn", () => {
    const apps = [...Array.from({ length: 8 }, (_, i) => app({ id: `a${i}` })), app({ id: "x", status: "interviewing" })];
    expect(funnelDiagnosis(apps)).toBeNull();
  });

  it("im lặng khi còn ít job", () => {
    expect(funnelDiagnosis([app({}), app({ id: "b" })])).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/insight-stats.test.ts
```
Expected: FAIL — `Cannot find module '../insight-stats'`

- [ ] **Step 3: Implement `insight-stats.ts`**

Tạo `apps/frontend/components/copilot/insight-stats.ts`:

```ts
import type { Application } from "@/lib/api";

/**
 * Ba phép tính của Insight tab — CỐ Ý không dùng LLM.
 *
 * "Apply 8 job chưa có phỏng vấn nào" là một luật xác định: hỏi model cùng
 * câu đó mỗi lần mở trang vừa tốn tiền vừa cho câu trả lời mỗi lần một khác.
 * Chỉ khối tóm tắt (DockInsight, gọi /api/applications/ai-summary) mới đáng
 * dùng LLM, vì nó thật sự cần diễn đạt tự nhiên.
 */
export type StaleCard = { id: string; title: string; days: number };
export type SourceStat = { source: string; total: number; interviewPlus: number };

const STALE_DAYS = 7;
const FUNNEL_MIN_APPLIED = 8;
const ADVANCED = new Set(["interviewing", "offer"]);

export function findStaleApplied(apps: Application[], today: Date = new Date()): StaleCard[] {
  return apps
    .filter((a) => a.status === "applied" && a.applied_at)
    .map((a) => ({
      id: a.id,
      title: a.title,
      days: Math.floor((today.getTime() - new Date(a.applied_at as string).getTime()) / 86_400_000),
    }))
    .filter((s) => s.days > STALE_DAYS)
    .sort((x, y) => y.days - x.days);
}

export function sourceBreakdown(apps: Application[]): SourceStat[] {
  const map = new Map<string, SourceStat>();
  for (const a of apps) {
    const row = map.get(a.source) ?? { source: a.source, total: 0, interviewPlus: 0 };
    row.total += 1;
    if (ADVANCED.has(a.status)) row.interviewPlus += 1;
    map.set(a.source, row);
  }
  return [...map.values()];
}

export function funnelDiagnosis(apps: Application[]): string | null {
  const applied = apps.filter((a) => a.status === "applied").length;
  const advanced = apps.filter((a) => ADVANCED.has(a.status)).length;
  if (applied < FUNNEL_MIN_APPLIED || advanced > 0) return null;
  return `Bạn đã apply ${applied} job mà chưa có phỏng vấn nào — có thể CV hoặc mức vị trí đang nhắm chưa khớp. Thử hỏi trợ lý xem nên chỉnh gì.`;
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/insight-stats.test.ts
```
Expected: PASS, 8 tests

- [ ] **Step 5: Kiểm tra `applicationsApi.aiSummary` đã tồn tại chưa**

```bash
cd apps/frontend && grep -n "aiSummary\|ai-summary" lib/api.ts
```

Nếu **không có kết quả**, thêm vào object `applicationsApi` trong `lib/api.ts`:

```ts
  aiSummary: (token: string) =>
    clientFetch<{ summary_md: string; generated_at: string }>("/api/applications/ai-summary", {
      method: "POST",
      headers: authHeaders(token),
    }),
```

- [ ] **Step 6: Implement `DockInsight.tsx`**

Tạo `apps/frontend/components/copilot/DockInsight.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { BoardData } from "@/app/applications/use-board-data";
import { applicationsApi } from "@/lib/api";
import { findStaleApplied, funnelDiagnosis, sourceBreakdown } from "./insight-stats";

const DISMISS_KEY = "tp_dock_nudge_dismissed";
const SUMMARY_KEY = "tp_dock_summary";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function DockInsight({ board }: { board: BoardData }) {
  const { apps, token } = board;
  // Mặc định true để lần render đầu (trước khi đọc localStorage) không loé
  // nudge rồi tắt.
  const [dismissed, setDismissed] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === todayKey());
    const cached = sessionStorage.getItem(SUMMARY_KEY);
    if (cached) setSummary(cached);
  }, []);

  const loadSummary = useCallback(async () => {
    if (!token || apps.length === 0) return;
    setLoading(true);
    setFailed(false);
    try {
      const res = await applicationsApi.aiSummary(token);
      setSummary(res.summary_md);
      sessionStorage.setItem(SUMMARY_KEY, res.summary_md);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [token, apps.length]);

  // Tự chạy MỘT lần mỗi session; sau đó user tự bấm làm mới. Mỗi lần gọi là
  // một lượt LLM có tính phí, không đáng chạy lại mỗi khi tab được mount lại.
  useEffect(() => {
    if (!summary && !loading && !failed && apps.length > 0) void loadSummary();
  }, [summary, loading, failed, apps.length, loadSummary]);

  if (apps.length === 0) {
    return <p className="p-4 text-sm text-text-muted">Chưa có job nào được track. Thêm job đầu tiên rồi mình tóm tắt cho.</p>;
  }

  const stale = findStaleApplied(apps);
  const diagnosis = funnelDiagnosis(apps);
  const sources = sourceBreakdown(apps);

  return (
    <div className="flex flex-col gap-4 p-4">
      {!dismissed && (stale.length > 0 || diagnosis) && (
        <section className="rounded-xl border border-border bg-surface-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1 text-sm text-text">
              {stale.length > 0 && (
                <p>
                  <b>{stale.length}</b> job đã apply quá 7 ngày chưa cập nhật — cũ nhất là{" "}
                  <b>{stale[0].title}</b> ({stale[0].days} ngày).
                </p>
              )}
              {diagnosis && <p className="text-text-muted">{diagnosis}</p>}
            </div>
            <button
              type="button"
              onClick={() => { localStorage.setItem(DISMISS_KEY, todayKey()); setDismissed(true); }}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface"
            >
              Ẩn
            </button>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Theo nguồn</h3>
        <ul className="flex flex-col gap-1">
          {sources.map((s) => (
            <li key={s.source} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-sm">
              <span className="text-text">{s.source}</span>
              <span className="tabular-nums text-text-muted">{s.interviewPlus}/{s.total} vào phỏng vấn</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tóm tắt</h3>
          <button
            type="button"
            onClick={() => void loadSummary()}
            disabled={loading}
            aria-label="Làm mới tóm tắt"
            className="rounded-md p-1 text-text-muted hover:bg-surface-2 disabled:opacity-50"
          >
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </button>
        </div>
        {failed ? (
          <button type="button" onClick={() => void loadSummary()} className="text-sm text-brand-600 underline">
            Không tóm tắt được. Thử lại
          </button>
        ) : summary ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{summary}</p>
        ) : (
          <p className="text-sm text-text-muted">Đang tóm tắt…</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 7: Truyền `insight` vào provider**

Trong `apps/frontend/app/applications/page.tsx`, thêm import:

```tsx
import DockInsight from "@/components/copilot/DockInsight";
```

và đổi dòng provider thành:

```tsx
      <CopilotDockProvider page="applications" insight={<DockInsight board={board} />}>
```

- [ ] **Step 8: Typecheck + toàn bộ test**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; jest tất cả PASS

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/components/copilot/insight-stats.ts \
        apps/frontend/components/copilot/__tests__/insight-stats.test.ts \
        apps/frontend/components/copilot/DockInsight.tsx \
        apps/frontend/app/applications/page.tsx \
        apps/frontend/lib/api.ts
git commit -m "feat(copilot): insight tab - nudge, ti le chuyen doi, tom tat"
```

---

### Task 5: Backend — hai agent tool thị trường

**Files:**
- Create: `apps/backend/app/services/agent/tools/market_tools.py`
- Modify: `apps/backend/app/services/agent/chains/skill_advisor_chain.py`
- Test: `apps/backend/tests/test_agent/test_market_tools.py`

**Interfaces:**
- Consumes: `call_mcp_tool` từ `app.services.agent.services.mcp_client`
- Produces: `salary_benchmark`, `company_hiring` (LangChain tool) — thêm vào `_BASE_TOOLS`

- [ ] **Step 1: VERIFY tool MCP trước khi viết bất cứ dòng nào**

Spec §8 yêu cầu bước này. Chạy:

```bash
cd /d/TalentPulse/talentpulse
grep -n "def get_salary_analysis" -A 25 apps/mcp/tools/analytics.py
grep -n "def get_top_companies" -A 25 apps/mcp/tools/analytics.py
grep -n "async def" apps/backend/app/services/agent/services/mcp_client.py
```

Ghi lại **chữ ký thật**: tên hàm client (có đúng là `call_mcp_tool` không), tên tham số MCP, kiểu trả về. Nếu `get_salary_analysis` **không** nhận cắt lát theo `city`/`level`, hoặc `get_top_companies` **không** lọc được theo tên công ty, thì **DỪNG LẠI** và báo người review — thêm read-tool vào `apps/mcp/tools/analytics.py` trước, đừng ép tool sai hình. Mọi tên trong Step 2–4 dưới đây phải sửa cho khớp kết quả bước này.

- [ ] **Step 2: Viết test thất bại**

Tạo `apps/backend/tests/test_agent/test_market_tools.py`:

```python
import pytest

from app.services.agent.tools import market_tools


@pytest.mark.asyncio
async def test_salary_benchmark_goi_mcp_va_tra_chuoi(monkeypatch):
    calls = []

    async def fake_call(tool_name, args):
        calls.append((tool_name, args))
        return {"p25": 18, "p50": 25, "p75": 34, "sample_size": 120}

    monkeypatch.setattr(market_tools, "call_mcp_tool", fake_call)
    out = await market_tools.salary_benchmark.ainvoke(
        {"title": "Data Engineer", "city": "HCMC", "level": "middle"}
    )

    assert calls, "phai goi MCP"
    assert "25" in out
    assert "Data Engineer" in out


@pytest.mark.asyncio
async def test_salary_benchmark_khong_nuot_loi(monkeypatch):
    async def boom(tool_name, args):
        raise RuntimeError("mcp down")

    monkeypatch.setattr(market_tools, "call_mcp_tool", boom)
    out = await market_tools.salary_benchmark.ainvoke({"title": "Data Engineer", "city": "HCMC"})

    assert "Không tra được" in out


@pytest.mark.asyncio
async def test_company_hiring_tra_ve_du_lieu(monkeypatch):
    async def fake_call(tool_name, args):
        return {"company": "VNG", "job_count": 42, "top_skills": ["python", "golang"]}

    monkeypatch.setattr(market_tools, "call_mcp_tool", fake_call)
    out = await market_tools.company_hiring.ainvoke({"company": "VNG"})

    assert "VNG" in out
    assert "42" in out


@pytest.mark.asyncio
async def test_company_hiring_bao_khi_khong_co_du_lieu(monkeypatch):
    async def fake_call(tool_name, args):
        return None

    monkeypatch.setattr(market_tools, "call_mcp_tool", fake_call)
    out = await market_tools.company_hiring.ainvoke({"company": "KhongTonTai"})

    assert "Không có dữ liệu" in out
```

- [ ] **Step 3: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/backend && python -m pytest tests/test_agent/test_market_tools.py -v
```
Expected: FAIL — `ModuleNotFoundError: ... market_tools`

- [ ] **Step 4: Implement `market_tools.py`**

Tạo `apps/backend/app/services/agent/tools/market_tools.py` (sửa tên tool/tham số MCP cho khớp Step 1):

```python
"""Hai tool đọc warehouse cho dock copilot: benchmark lương và soi công ty.

Cả hai chỉ ĐỌC và bọc quanh MCP tool sẵn có. Không tự truy vấn Postgres —
mọi đường vào warehouse của agent đi qua MCP để chỉ có một chỗ kiểm soát
quyền đọc.
"""
from __future__ import annotations

import logging

from langchain_core.tools import tool

from app.services.agent.services.mcp_client import call_mcp_tool

logger = logging.getLogger(__name__)


@tool
async def salary_benchmark(title: str, city: str, level: str | None = None) -> str:
    """Look up the real salary distribution for a job title in a city from the
    warehouse. Use when the user asks whether an offer or a posted salary is
    good, or what a role pays. Returns percentiles in million VND/month."""
    try:
        data = await call_mcp_tool(
            "get_salary_analysis",
            {"title": title, "city": city, "level": level},
        )
    except Exception:
        logger.exception("salary_benchmark failed for %s/%s", title, city)
        return "Không tra được dữ liệu lương lúc này. Nói với user là thử lại sau."

    if not data:
        return f"Không có dữ liệu lương cho {title} tại {city} trong kho."

    return (
        f"Lương {title} tại {city}"
        + (f" (level {level})" if level else "")
        + f": p25={data.get('p25')}tr, trung vị={data.get('p50')}tr, "
        f"p75={data.get('p75')}tr (mẫu {data.get('sample_size')} tin tuyển dụng)."
    )


@tool
async def company_hiring(company: str) -> str:
    """Look up how actively a company is hiring and what skills they ask for,
    from the warehouse. Use when the user asks about a company they applied to
    or are considering."""
    try:
        data = await call_mcp_tool("get_top_companies", {"company": company})
    except Exception:
        logger.exception("company_hiring failed for %s", company)
        return "Không tra được dữ liệu công ty lúc này. Nói với user là thử lại sau."

    if not data:
        return f"Không có dữ liệu tuyển dụng của {company} trong kho."

    skills = ", ".join(data.get("top_skills") or []) or "chưa rõ"
    return (
        f"{data.get('company', company)}: {data.get('job_count')} tin tuyển dụng "
        f"trong kho. Kỹ năng hay yêu cầu: {skills}."
    )
```

- [ ] **Step 5: Chạy test để chắc chắn nó PASS**

```bash
cd apps/backend && python -m pytest tests/test_agent/test_market_tools.py -v
```
Expected: PASS, 4 tests

- [ ] **Step 6: Đăng ký vào agent**

Trong `apps/backend/app/services/agent/chains/skill_advisor_chain.py`, thêm import:

```python
from app.services.agent.tools.market_tools import company_hiring, salary_benchmark
```

và thay `_BASE_TOOLS` thành:

```python
_BASE_TOOLS = [
    query_skill_gap,
    get_cv_writing_guide,
    search_jobs_realtime,
    list_my_applications,
    get_application_stats,
    edit_cv,
    salary_benchmark,
    company_hiring,
]
```

- [ ] **Step 7: Chạy toàn bộ test agent**

```bash
cd apps/backend && python -m pytest tests/test_agent -v
```
Expected: tất cả PASS

- [ ] **Step 8: Commit**

```bash
git add apps/backend/app/services/agent/tools/market_tools.py \
        apps/backend/app/services/agent/chains/skill_advisor_chain.py \
        apps/backend/tests/test_agent/test_market_tools.py
git commit -m "feat(agent): salary_benchmark + company_hiring doc warehouse qua MCP"
```

---

### Task 6: Regression flag-off + E2E + chốt

**Files:** không file mới (trừ khi vá lỗi tìm thấy).

- [ ] **Step 1: Build bản flag TẮT và kiểm tra zero regression**

```bash
cd /d/TalentPulse/talentpulse && docker compose build frontend && docker compose up -d --no-build frontend
```
(không truyền `NEXT_PUBLIC_COPILOT_DOCK` ⇒ mặc định rỗng ⇒ tắt)

Mở `http://localhost:8002/applications`. Expected:
- Không có dock, không có nút nổi mobile.
- Board rộng như trước, kéo-thả chuột vẫn đổi cột và vẫn persist sau F5.
- DevTools → Network: **không** request nào tới `/api/copilotkit`, **không** tải `styles.css` của CopilotKit.
- Console sạch.

- [ ] **Step 2: Build bản flag BẬT**

```bash
cd /d/TalentPulse/talentpulse && NEXT_PUBLIC_AI_HOME=1 NEXT_PUBLIC_COPILOT_DOCK=1 docker compose build frontend && docker compose up -d --no-build frontend
```

- [ ] **Step 3: Chạy checklist E2E bằng tay**

Đăng nhập `uitest@example.com` / `TestWorkflow123!` tại `http://localhost:8002/applications`.

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | "chuyển Business Analyst sang phỏng vấn" | Card nhảy cột · toast có **Hoàn tác** · F5 vẫn ở cột mới |
| 2 | bấm **Hoàn tác** ngay sau (1) | Card về cột cũ · F5 xác nhận |
| 3 | "chuyển data sang offer" | AI **hỏi lại**, liệt kê card khớp, không tự chọn |
| 4 | "chuyển job kubernetes sang offer" | AI báo không tìm thấy, không đụng board |
| 5 | "thêm job AI Engineer ở VNG mình apply hôm qua" | Card mới ở cột **Đã apply** · DB có `source='manual'`, `source_job_id` NULL |
| 6 | "ghi chú vào Data Analyst: HR hẹn vòng 2 thứ 5" | `notes` có dòng `[DD/MM] HR hẹn…` |
| 7 | lặp lại (6) với nội dung khác | `notes` có **cả hai** dòng — chữ cũ còn nguyên |
| 8 | "lương Data Engineer ở HCMC bao nhiêu?" | Trả số từ warehouse, không bịa |
| 9 | "VNG dạo này tuyển nhiều không?" | Trả số tin tuyển dụng thật |
| 10 | mở tab **Insight** | Nudge (nếu có job quá 7 ngày) · bảng theo nguồn · tóm tắt |
| 11 | bấm **Ẩn** ở nudge rồi F5 | Nudge không hiện lại trong ngày |
| 12 | thu cửa sổ còn ~1440px | Cột giữ ≥260px, board cuộn ngang, không cột nào bị bóp méo |

Xác minh DB cho (5), (6), (7):
```bash
docker exec talentpulse-postgres psql -U admin -d warehouse -c \
  "select title, source, source_job_id, status, notes from app.job_applications where user_id='e75736a6-98d9-4a1c-89f6-773521062b64' order by updated_at desc limit 3;"
```

- [ ] **Step 4: Gate cuối**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
cd ../backend && python -m pytest tests/test_agent -v
```
Expected: tất cả xanh.

- [ ] **Step 5: Cập nhật tiến độ**

Nối kết quả checklist vào cuối `.superpowers/sdd/progress.md` (không đè phần của plan 16/07).

- [ ] **Step 6: Commit**

```bash
git add .superpowers/sdd/progress.md
git commit -m "chore(copilot): chot E2E board copilot v1"
```

---

## Ngoài phạm vi plan này

- Tầng 4 (tạo interview session từ card, may đo CV theo JD) → v1.5.
- Dock cho `/jobs` → đợt sau, dùng lại nguyên `resolve-card` + `undo-toast`.
- `bulk_move` — cần UI xác nhận nhiều card.
- **Lỗi kéo bằng bàn phím** (`ApplicationBoard.tsx`: `useSensor(KeyboardSensor)` thiếu `coordinateGetter`, WCAG 2.1.1) — phát hiện trong audit 2026-07-23, phải sửa riêng, không thuộc plan này.
