# Dock Tool Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kết quả tool của dock hiện ra thành card UI thật trong chat, thay vì chỉ một dòng chữ.

**Architecture:** Thêm wrapper thứ hai `useDockToolCard` vào `copilot-bridge.tsx` bọc `useRenderTool` của CopilotKit v2 (`render` là lớp **bổ sung**, chuỗi handler vẫn tới agent nguyên vẹn). Ba giai đoạn tăng dần: probe bằng `useDefaultRenderTool()` → card riêng đọc từ `parameters`/`result` → handler trả object cho card giàu dữ liệu. Spec: `docs/superpowers/specs/2026-07-25-dock-tool-cards-design.md`.

**Tech Stack:** Next.js 14, `@copilotkit/react-core@1.62.3` (namespace v2), `zod@^3.25.76`, Tailwind v4, Jest + RTL.

## Global Constraints

- Mọi lệnh frontend chạy trong `apps/frontend`. Gate mỗi task: `npx tsc --noEmit` exit 0 và `npm test` xanh.
- **NEVER `git add .` / `git add -A`.** Repo có noise (`apps/frontend/tsconfig.tsbuildinfo`). Stage đúng path nêu trong task.
- **Chỉ `copilot-bridge.tsx` được import hook CopilotKit trực tiếp.** Component card **không** được import CopilotKit — nó chỉ nhận `DockToolCardProps` do bridge định nghĩa.
- **Card là lớp bổ sung.** Bỏ hết card đi thì 4 tool vẫn phải chạy y như trước.
- **AI không được xoá application.** Không thêm tool delete.
- Flag `NEXT_PUBLIC_COPILOT_DOCK` — chỉ `"1"` bật dock.
- Identifier tiếng Anh; copy UI + comment tiếng Việt. Brand **"TalentPuse"**.
- Token màu sẵn có: `bg-surface`, `bg-surface-2`, `border-border`, `text-text`, `text-text-muted`, `brand-*`, `ring-border`. **Class Tailwind phải là literal**, không ghép động (purge sẽ cắt).
- Status card, đúng thứ tự cột: `saved · applied · interviewing · offer · rejected`.

---

## Sự thật đã xác minh trong `node_modules/@copilotkit/react-core@1.62.3`

Đây là ground truth — **không** đọc docs trong `.agents/skills/` rồi tin, docs có thể lệch version.

```ts
// copilotkit-Bp6BD8xe.d.mts:2286 — overload CÓ TÊN
declare function useRenderTool<S extends StandardSchemaV1>(config: {
  name: string;
  parameters: S;                                          // Standard Schema (zod)
  render: (props: RenderToolProps<S>) => React.ReactElement;
  agentId?: string;
}, deps?: ReadonlyArray<unknown>): void;

// :2229 — union phân biệt theo status, STRING LITERAL (không phải enum)
interface RenderToolInProgressProps<S> { name: string; toolCallId: string;
  parameters: Partial<InferSchemaOutput<S>>; status: "inProgress"; result: undefined }
interface RenderToolExecutingProps<S>  { name: string; toolCallId: string;
  parameters: InferSchemaOutput<S>;          status: "executing";  result: undefined }
interface RenderToolCompleteProps<S>   { name: string; toolCallId: string;
  parameters: InferSchemaOutput<S>;          status: "complete";   result: string }

// :2337 — wildcard, props dùng string literal luôn
declare function useDefaultRenderTool(config?: {
  render?: (props: DefaultRenderProps) => React.ReactElement;
}, deps?: ReadonlyArray<unknown>): void;
type DefaultRenderProps = { name: string; toolCallId: string; parameters: unknown;
  status: "inProgress" | "executing" | "complete"; result: string | undefined };
```

**Bốn hệ quả bắt buộc:**

1. `render` trả `React.ReactElement` — **không được `return null`**; muốn trống thì `return <></>`.
2. `ToolCallStatus` (enum) **không** export từ `react-core/v2` (grep = 0). Dùng string literal.
3. `useRenderTool` và `useFrontendTool` ghi **cùng key registry** `":name"` → **không** đăng ký cả hai cho một tool trong cùng một hook. Đó là lý do phải có wrapper **thứ hai**, tách biệt.
4. `useRenderTool` **không tự dọn** renderer khi unmount → wrapper phải tự cleanup.

## Interface đã có (đọc trước, không đoán lại)

```ts
// components/copilot/copilot-bridge.tsx — SẼ SỬA ở Task 2
export type DockToolParam = { name: string; type: "string"|"number"|"boolean";
  description: string; required?: boolean; enum?: string[] };
export type DockTool = { name: string; description: string;
  parameters: DockToolParam[]; handler: (args: Record<string, unknown>) => Promise<string> };
export function useDockTool(tool: DockTool): void;
export function useDockContext(description: string, value: unknown): void;
// BÊN TRONG file đã có `buildParameterSchema(parameters: DockToolParam[])` dựng zod schema thật —
// DÙNG LẠI hàm đó cho wrapper mới, không viết hàm thứ hai.
```

`BoardCopilot.tsx` đọc dữ liệu tươi qua ref (hiện là `appsRef.current`), không đọc `apps` từ closure. Đọc file để lấy đúng tên.

## File Structure

| File | Trạng thái | Trách nhiệm |
|---|---|---|
| `components/copilot/DockChat.tsx` | sửa | Task 1: gọi `useDefaultRenderTool()` (probe), Task 2 bỏ đi |
| `components/copilot/copilot-bridge.tsx` | sửa | Task 2: thêm `useDockToolCard` + `DockToolCardProps`; Task 3: nới kiểu handler |
| `components/copilot/cards/MoveApplicationCard.tsx` | tạo | Task 2 |
| `components/copilot/__tests__/move-application-card.test.tsx` | tạo | Task 2 |
| `components/copilot/BoardCopilot.tsx` | sửa | Task 2: đăng ký card; Task 3: handler trả object |
| `components/copilot/cards/AppendNoteCard.tsx` | tạo | Task 3 |
| `components/copilot/__tests__/append-note-card.test.tsx` | tạo | Task 3 |
| `apps/backend/app/services/agent/prompts/skill_advisor_prompt.py` | sửa | Task 3: quy ước field `message` |

Card đặt trong thư mục con `cards/` vì `components/copilot/` đã có 8 file; card sẽ còn thêm.

---

### Task 1: Probe — `useDefaultRenderTool()`

Một dòng. Mục đích **không** phải ship card đẹp, mà trả lời một câu hỏi mà nếu sai thì Task 2 vô nghĩa: **renderer không-`agentId` có bắt được tool call của agent `talentpuse_assistant` không?**

**Files:**
- Modify: `apps/frontend/components/copilot/DockChat.tsx`

**Interfaces:**
- Consumes: `useDefaultRenderTool` từ `@copilotkit/react-core/v2`
- Produces: không (chỉ probe; Task 2 sẽ bỏ)

- [ ] **Step 1: Thêm probe**

Trong `apps/frontend/components/copilot/DockChat.tsx`, sửa dòng import đang có thành:
```tsx
import { CopilotChat, useDefaultRenderTool } from "@copilotkit/react-core/v2";
```

Trong thân `DockChat`, **trước** mọi early return:
```tsx
  // PROBE (Task 1): card mặc định cho mọi tool, để xác nhận renderer chạy được
  // trong dock trước khi viết card riêng. Task 2 sẽ bỏ đi.
  useDefaultRenderTool(
    {
      render: ({ name, status, result }) => (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-muted">
          <span className="font-mono">{name}</span> · {status}
          {result ? <div className="mt-1 text-text">{result}</div> : null}
        </div>
      ),
    },
    [],
  );
```

⚠️ `useDefaultRenderTool` là hook — phải gọi **trước** `if (!user) return null;` đang có trong file, nếu không sẽ vi phạm rules-of-hooks.

- [ ] **Step 2: Typecheck + test**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; toàn bộ test xanh (chưa thêm test mới).

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/copilot/DockChat.tsx
git commit -m "feat(copilot): probe useDefaultRenderTool trong dock"
```

- [ ] **Step 4: BÁO LẠI cho controller — đây là cổng chặn**

Controller sẽ rebuild + mở browser xem card mặc định có hiện hay không. **Dừng ở đây**, ghi rõ trong report rằng cần controller xác nhận trước khi làm Task 2. Nếu card **không** hiện, Task 2 phải thêm `agentId: "talentpuse_assistant"` vào renderer — biết trước rẻ hơn viết xong card mới phát hiện.

---

### Task 2: `useDockToolCard` + card `move_application`

**Files:**
- Modify: `apps/frontend/components/copilot/copilot-bridge.tsx`
- Create: `apps/frontend/components/copilot/cards/MoveApplicationCard.tsx`
- Test: `apps/frontend/components/copilot/__tests__/move-application-card.test.tsx`
- Modify: `apps/frontend/components/copilot/BoardCopilot.tsx`
- Modify: `apps/frontend/components/copilot/DockChat.tsx` (bỏ probe của Task 1)

**Interfaces:**
- Consumes: `buildParameterSchema` (đã có trong bridge), `DockToolParam`
- Produces:
```ts
export type DockToolCardProps = {
  name: string;
  toolCallId: string;
  parameters: Record<string, unknown>;   // PARTIAL khi đang stream
  status: "inProgress" | "executing" | "complete";
  result?: string;
};
export type DockToolCard = {
  name: string;
  parameters: DockToolParam[];
  render: (props: DockToolCardProps) => React.ReactElement;
};
export function useDockToolCard(card: DockToolCard): void;
```

- [ ] **Step 1: Viết test thất bại cho card**

Tạo `apps/frontend/components/copilot/__tests__/move-application-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MoveApplicationCard from "../cards/MoveApplicationCard";

describe("MoveApplicationCard", () => {
  it("không crash khi đang stream và parameters còn RỖNG", () => {
    // parameters KHÔNG được zod validate — runtime chỉ partialJSONParse.
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{}}
        status="inProgress"
      />,
    );
    expect(screen.getByText(/đang chuyển/i)).toBeInTheDocument();
  });

  it("không crash khi status=complete mà parameters vẫn thiếu field", () => {
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{}}
        status="complete"
        result="Đã chuyển xong."
      />,
    );
    expect(screen.getByText("Đã chuyển xong.")).toBeInTheDocument();
  });

  it("hiện tên card và cột đích khi hoàn tất", () => {
    render(
      <MoveApplicationCard
        name="move_application"
        toolCallId="t1"
        parameters={{ card: "Business Analyst", status: "interviewing" }}
        status="complete"
        result='Đã chuyển "Business Analyst" từ saved sang interviewing.'
      />,
    );
    expect(screen.getByText("Business Analyst")).toBeInTheDocument();
    expect(screen.getByText("Phỏng vấn")).toBeInTheDocument();
  });

  it("gộp inProgress và executing thành cùng một trạng thái chờ", () => {
    const { rerender } = render(
      <MoveApplicationCard name="move_application" toolCallId="t1"
        parameters={{ card: "X" }} status="inProgress" />,
    );
    expect(screen.getByText(/đang chuyển/i)).toBeInTheDocument();
    rerender(
      <MoveApplicationCard name="move_application" toolCallId="t1"
        parameters={{ card: "X" }} status="executing" />,
    );
    expect(screen.getByText(/đang chuyển/i)).toBeInTheDocument();
  });

  it("gọi onUndo khi bấm Hoàn tác", async () => {
    const onUndo = jest.fn();
    render(
      <MoveApplicationCard name="move_application" toolCallId="t1"
        parameters={{ card: "Business Analyst", status: "offer" }}
        status="complete" result="ok" onUndo={onUndo} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /hoàn tác/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("KHÔNG hiện nút Hoàn tác khi chưa hoàn tất", () => {
    render(
      <MoveApplicationCard name="move_application" toolCallId="t1"
        parameters={{ card: "X" }} status="inProgress" onUndo={jest.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /hoàn tác/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/move-application-card.test.tsx
```
Expected: FAIL — `Cannot find module '../cards/MoveApplicationCard'`.

- [ ] **Step 3: Viết card**

Tạo `apps/frontend/components/copilot/cards/MoveApplicationCard.tsx`:

```tsx
"use client";
import type { DockToolCardProps } from "../copilot-bridge";

/** Nhãn tiếng Việt của từng cột, khớp bảng Kanban. */
const STATUS_LABEL: Record<string, string> = {
  saved: "Đã lưu",
  applied: "Đã apply",
  interviewing: "Phỏng vấn",
  offer: "Offer",
  rejected: "Từ chối",
};

/**
 * Card cho tool `move_application`.
 *
 * Chỉ đọc `parameters` + `result` — KHÔNG đụng vào state của trang. Renderer
 * sống dai hơn trang /applications (useRenderTool không tự dọn), nên giữ ref
 * tới state page sẽ rò rỉ.
 *
 * `parameters` KHÔNG được zod validate (runtime chỉ partialJSONParse) nên mọi
 * field có thể thiếu — kể cả khi status="complete". Guard từng field.
 */
export default function MoveApplicationCard({
  parameters,
  status,
  result,
  onUndo,
}: DockToolCardProps & { onUndo?: () => void }) {
  const cardName = typeof parameters.card === "string" ? parameters.card : null;
  const target = typeof parameters.status === "string" ? parameters.status : null;
  const targetLabel = target ? (STATUS_LABEL[target] ?? target) : null;

  // Chỉ 2 trạng thái thị giác, không 3: "executing" có thể trôi qua nhanh hơn
  // một lần paint nên thiết kế riêng cho nó là công cốc.
  const done = status === "complete";

  if (!done) {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
        Đang chuyển{cardName ? ` "${cardName}"` : ""}…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-text">{cardName ?? "Job"}</span>
        {targetLabel && (
          <>
            <span className="text-text-muted">→</span>
            <span className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-text ring-1 ring-inset ring-border">
              {targetLabel}
            </span>
          </>
        )}
      </div>
      {result && <p className="text-xs leading-relaxed text-text-muted">{result}</p>}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="self-start rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-surface"
        >
          Hoàn tác
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/move-application-card.test.tsx
```
Expected: PASS, 6 test.

- [ ] **Step 5: Xác minh API dọn renderer TRƯỚC khi viết wrapper**

```bash
cd apps/frontend && grep -rn "removeHookRenderToolCall\|removeRenderToolCall\|removeHook" node_modules/@copilotkit/react-core/dist/*.d.mts node_modules/@copilotkit/core/dist/index.d.mts | head -8
```

Ghi lại tên **thật** của hàm dọn. Nếu **không có** API dọn nào, bỏ `useEffect` cleanup ở Step 6 và ghi rõ trong report rằng renderer bị rò và đó là giới hạn của lib — **đừng** bịa tên hàm.

- [ ] **Step 6: Thêm `useDockToolCard` vào bridge**

Trong `apps/frontend/components/copilot/copilot-bridge.tsx`: thêm `useRenderTool` và `useCopilotKit` vào dòng import đang có từ `@copilotkit/react-core/v2` (đừng tạo import thứ hai), thêm `useEffect` vào import từ `react`.

Thêm vào cuối file:

```tsx
/**
 * Props mà một card của dock nhận. Bridge tự định nghĩa (không re-export type
 * của CopilotKit) để component card KHÔNG phải import CopilotKit — giữ nguyên
 * bất biến "chỉ file này biết CopilotKit".
 *
 * `status` là string literal, KHÔNG dùng enum `ToolCallStatus`: enum đó không
 * được export từ "@copilotkit/react-core/v2" (chỉ có ở @copilotkit/core, là
 * phantom dependency của package này).
 *
 * `parameters` để lỏng `Record<string, unknown>`: runtime chỉ partialJSONParse
 * chứ KHÔNG validate bằng zod, nên kiểu chặt sẽ là một lời hứa sai. Card phải
 * guard từng field, kể cả ở nhánh complete.
 */
export type DockToolCardProps = {
  name: string;
  toolCallId: string;
  parameters: Record<string, unknown>;
  status: "inProgress" | "executing" | "complete";
  result?: string;
};

export type DockToolCard = {
  /** Trùng đúng `name` của tool tương ứng. */
  name: string;
  parameters: DockToolParam[];
  /** Phải trả ReactElement — `useRenderTool` không nhận null; muốn trống thì <></>. */
  render: (props: DockToolCardProps) => React.ReactElement;
};

/**
 * Đăng ký card UI cho kết quả của một tool. TÁCH RIÊNG khỏi `useDockTool`:
 * `useFrontendTool` và `useRenderTool` ghi vào CÙNG một key registry (":name"),
 * nên nhồi cả hai vào một hook sẽ đá nhau với thứ tự không xác định.
 *
 * `render` là lớp BỔ SUNG — chuỗi handler vẫn tới agent qua ToolMessage như cũ.
 */
export function useDockToolCard(card: DockToolCard): void {
  const { copilotkit } = useCopilotKit();

  // Y hệt bài học handlerRef: renderer bị chốt lúc register, không tự làm mới
  // theo render sau.
  const renderRef = useRef(card.render);
  renderRef.current = card.render;

  const parametersKey = JSON.stringify(card.parameters);
  const parameterSchema = useMemo(
    () => buildParameterSchema(card.parameters),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parametersKey là dep theo nội dung, cố ý
    [parametersKey],
  );

  // Component identity phải ỔN ĐỊNH. Nếu type component đổi mỗi lần re-register,
  // React unmount card và mất hết useState bên trong nó.
  const Component = useMemo(
    () => (props: DockToolCardProps) => renderRef.current(props),
    [],
  );

  useRenderTool(
    {
      name: card.name,
      parameters: parameterSchema,
      render: Component as unknown as (props: never) => React.ReactElement,
    },
    [card.name, parametersKey],
  );

  // useRenderTool KHÔNG tự dọn renderer. Thiếu cleanup thì renderer sống dai
  // hơn trang /applications. Tên hàm dọn lấy từ Step 5.
  useEffect(() => {
    const name = card.name;
    return () => {
      copilotkit.removeHookRenderToolCall?.(name);
    };
  }, [card.name, copilotkit]);
}
```

⚠️ Cast `as unknown as (props: never) => React.ReactElement` là để bắc qua chỗ `useRenderTool` suy ra kiểu `parameters` từ zod generic, còn `DockToolCardProps` cố tình để lỏng. Nếu `tsc` báo lỗi khác, **sửa cho hết lỗi chứ đừng thêm `@ts-ignore`**, và ghi lại cách sửa trong report.

⚠️ `removeHookRenderToolCall?.(name)` — thay bằng tên thật tìm được ở Step 5. Nếu không có API nào, xoá cả `useEffect` này.

- [ ] **Step 7: Đăng ký card trong `BoardCopilot`, bỏ probe của Task 1**

Trong `apps/frontend/components/copilot/BoardCopilot.tsx`, sửa dòng import bridge đang có thành:
```tsx
import { useDockContext, useDockTool, useDockToolCard } from "./copilot-bridge";
import MoveApplicationCard from "./cards/MoveApplicationCard";
```

Sau khối `useDockTool({ name: "move_application", ... })`, thêm:
```tsx
  // Card cho move_application. Dùng ĐÚNG bộ parameters của tool để schema khớp.
  useDockToolCard({
    name: "move_application",
    parameters: [
      { name: "card", type: "string", required: true, description: "Job title of the card." },
      { name: "status", type: "string", required: true, enum: STATUSES, description: "Target column." },
    ],
    render: (props) => <MoveApplicationCard {...props} />,
  });
```

Trong `apps/frontend/components/copilot/DockChat.tsx`: **bỏ** `useDefaultRenderTool` và khối render probe đã thêm ở Task 1, trả dòng import về `import { CopilotChat } from "@copilotkit/react-core/v2";`. Probe hết việc — giữ lại thì nó là wildcard fallback trùng lặp.

- [ ] **Step 8: Typecheck + toàn bộ suite**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; toàn bộ test xanh (test cũ + 6 test card).

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/components/copilot/copilot-bridge.tsx \
        apps/frontend/components/copilot/cards/MoveApplicationCard.tsx \
        apps/frontend/components/copilot/__tests__/move-application-card.test.tsx \
        apps/frontend/components/copilot/BoardCopilot.tsx \
        apps/frontend/components/copilot/DockChat.tsx
git commit -m "feat(copilot): useDockToolCard + card cho move_application"
```

---

### Task 3: Handler trả object + card `append_note`

**Files:**
- Modify: `apps/frontend/components/copilot/copilot-bridge.tsx`
- Modify: `apps/frontend/components/copilot/BoardCopilot.tsx`
- Create: `apps/frontend/components/copilot/cards/AppendNoteCard.tsx`
- Test: `apps/frontend/components/copilot/__tests__/append-note-card.test.tsx`
- Modify: `apps/frontend/components/copilot/__tests__/board-copilot.test.tsx`
- Modify: `apps/backend/app/services/agent/prompts/skill_advisor_prompt.py`

**Interfaces:**
- Consumes: `DockToolCardProps`, `useDockToolCard` (Task 2)
- Produces: `DockTool.handler` nới thành `(args) => Promise<string | Record<string, unknown>>`

- [ ] **Step 1: Nới kiểu handler trong bridge**

Trong `apps/frontend/components/copilot/copilot-bridge.tsx`, sửa type `DockTool`:

```ts
export type DockTool = {
  /** snake_case, vd "set_job_filters" */
  name: string;
  /** tiếng Anh, nói rõ khi nào dùng */
  description: string;
  parameters: DockToolParam[];
  /**
   * string = câu để LLM đọc. Object = dữ liệu giàu cho card; runtime tự
   * JSON.stringify nên card JSON.parse(result) được, còn agent nhận JSON đó.
   *
   * QUY ƯỚC BẮT BUỘC khi trả object: phải có field `message: string` chứa đúng
   * câu agent nên nói lại. Thiếu nó, agent sẽ dán JSON thô vào mặt user —
   * SYSTEM_PROMPT có một dòng dặn dùng `message`, hai chỗ phải khớp nhau.
   */
  handler: (args: Record<string, unknown>) => Promise<string | Record<string, unknown>>;
};
```

Giữ nguyên `handler: async (args) => handlerRef.current(args)` bên trong `useDockTool` — runtime CopilotKit tự serialize. Nếu `tsc` báo lỗi kiểu ở đó, ép qua `unknown` chứ **không** đổi type `FrontendTool` của lib.

- [ ] **Step 2: Viết test thất bại cho card note**

Tạo `apps/frontend/components/copilot/__tests__/append-note-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import AppendNoteCard from "../cards/AppendNoteCard";

describe("AppendNoteCard", () => {
  it("hiện dòng note vừa thêm khi result là JSON", () => {
    render(
      <AppendNoteCard
        name="append_note"
        toolCallId="t1"
        parameters={{ card: "Data Analyst", note: "HR hẹn vòng 2" }}
        status="complete"
        result={JSON.stringify({
          message: "Đã ghi chú.",
          line: "[25/07] HR hẹn vòng 2",
          card: "Data Analyst",
        })}
      />,
    );
    expect(screen.getByText("[25/07] HR hẹn vòng 2")).toBeInTheDocument();
    expect(screen.getByText("Data Analyst")).toBeInTheDocument();
  });

  it("không crash khi result KHÔNG phải JSON (handler cũ trả chuỗi)", () => {
    render(
      <AppendNoteCard name="append_note" toolCallId="t1"
        parameters={{ card: "Data Analyst", note: "x" }}
        status="complete" result="Đã thêm ghi chú vào Data Analyst." />,
    );
    expect(screen.getByText("Đã thêm ghi chú vào Data Analyst.")).toBeInTheDocument();
  });

  it("không crash khi parameters rỗng lúc đang stream", () => {
    render(
      <AppendNoteCard name="append_note" toolCallId="t1" parameters={{}} status="inProgress" />,
    );
    expect(screen.getByText(/đang ghi chú/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó FAIL**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/append-note-card.test.tsx
```
Expected: FAIL — `Cannot find module '../cards/AppendNoteCard'`.

- [ ] **Step 4: Viết card note**

Tạo `apps/frontend/components/copilot/cards/AppendNoteCard.tsx`:

```tsx
"use client";
import type { DockToolCardProps } from "../copilot-bridge";

/**
 * Card cho `append_note`. `result` có thể là JSON (handler mới) HOẶC chuỗi
 * thuần (handler cũ) — phải chịu được cả hai, vì card là lớp bổ sung và không
 * được vỡ khi handler chưa kịp đổi.
 */
type NotePayload = { message?: string; line?: string; card?: string };

function parsePayload(result: string | undefined): NotePayload | null {
  if (!result) return null;
  try {
    const parsed: unknown = JSON.parse(result);
    return parsed !== null && typeof parsed === "object" ? (parsed as NotePayload) : null;
  } catch {
    return null; // chuỗi thuần, không phải JSON — hợp lệ
  }
}

export default function AppendNoteCard({ parameters, status, result }: DockToolCardProps) {
  const cardName = typeof parameters.card === "string" ? parameters.card : null;

  if (status !== "complete") {
    return (
      <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text-muted">
        Đang ghi chú{cardName ? ` vào "${cardName}"` : ""}…
      </div>
    );
  }

  const payload = parsePayload(result);
  const shownName = payload?.card ?? cardName;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface-2 p-3">
      {shownName && <span className="text-sm font-medium text-text">{shownName}</span>}
      {payload?.line ? (
        <p className="rounded-md bg-surface px-2 py-1 font-mono text-xs text-text">{payload.line}</p>
      ) : (
        <p className="text-xs leading-relaxed text-text-muted">{payload?.message ?? result}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Chạy test để chắc chắn nó PASS**

```bash
cd apps/frontend && npx jest components/copilot/__tests__/append-note-card.test.tsx
```
Expected: PASS, 3 test.

- [ ] **Step 6: `append_note` trả object + đăng ký card**

Trong `apps/frontend/components/copilot/BoardCopilot.tsx`, ở handler của `append_note`, thay **câu return thành công cuối cùng** bằng object. Giữ nguyên mọi nhánh lỗi / nhập nhằng / chưa đăng nhập đang trả chuỗi — nhánh lỗi không cần card giàu:

```tsx
      return {
        message: `Đã thêm ghi chú vào "${card.title}".`,
        card: card.title,
        line: `${noteStamp()} ${note}`,
      };
```

Thêm `import AppendNoteCard from "./cards/AppendNoteCard";` và đăng ký card:
```tsx
  useDockToolCard({
    name: "append_note",
    parameters: [
      { name: "card", type: "string", required: true, description: "Job title of the card, or its id." },
      { name: "note", type: "string", required: true, description: "The note text to append." },
    ],
    render: (props) => <AppendNoteCard {...props} />,
  });
```

**Test cũ sẽ fail:** `board-copilot.test.tsx` có test assert `append_note` trả **chuỗi**. Sửa nó thành assert object có `message` và `line` đúng — đây là thay đổi hành vi **có ý thức**, ghi rõ trong commit message. **Đừng** nới assertion thành `expect.anything()` cho qua.

- [ ] **Step 7: Thêm quy ước vào prompt backend**

Trong `apps/backend/app/services/agent/prompts/skill_advisor_prompt.py`, thêm vào cuối mục `## Sự thật`:

```
- Tool có thể trả JSON. Khi đó dùng field `message` để trả lời user; TUYỆT ĐỐI không
  đọc lại JSON thô hay liệt kê các field khác cho user — UI đã hiện chúng thành card.
```

- [ ] **Step 8: Typecheck + toàn bộ suite**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tsc exit 0; tất cả xanh (kể cả test cũ đã sửa ở Step 6).

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/components/copilot/copilot-bridge.tsx \
        apps/frontend/components/copilot/BoardCopilot.tsx \
        apps/frontend/components/copilot/cards/AppendNoteCard.tsx \
        apps/frontend/components/copilot/__tests__/append-note-card.test.tsx \
        apps/frontend/components/copilot/__tests__/board-copilot.test.tsx \
        apps/backend/app/services/agent/prompts/skill_advisor_prompt.py
git commit -m "feat(copilot): handler tra object + card cho append_note"
```

---

### Task 4: Verify tay (controller — cần Docker + browser)

**Files:** không file mới (trừ khi vá lỗi tìm thấy).

- [ ] **Step 1: Rebuild**

```bash
cd /d/TalentPulse/talentpulse
PW=$(docker inspect talentpulse-postgres --format '{{range .Config.Env}}{{println .}}{{end}}' | grep '^POSTGRES_PASSWORD=' | cut -d= -f2)
export DATABASE_URL="postgresql://admin:${PW}@talentpulse-postgres:5432/warehouse"
export MCP_DATABASE_URL="$DATABASE_URL"
NEXT_PUBLIC_AI_HOME=1 NEXT_PUBLIC_COPILOT_DOCK=1 docker compose build frontend backend
docker compose up -d --no-build frontend backend
docker network connect talentpulse tp-backend 2>/dev/null; docker restart tp-backend
```

`docker network connect` là bắt buộc: `docker compose up` tái tạo container vào network `talentpulse_talentpulse`, còn `talentpulse-postgres` ở network `talentpulse` do compose của `pipeline_data` tạo.

- [ ] **Step 2: Checklist**

Đăng nhập `uitest@example.com` / `TestWorkflow123!` tại `http://localhost:8002/applications`, **bấm "Cuộc trò chuyện mới"** trước khi test.

| # | Thao tác | Kỳ vọng |
|---|---|---|
| 1 | "chuyển Business Analyst sang phỏng vấn" | **Card** hiện: tên job → badge "Phỏng vấn", không chỉ chữ |
| 2 | Nhìn lúc đang chạy | Có khung "Đang chuyển…" rồi mới thành card đầy |
| 3 | "ghi chú vào Data Analyst: HR hẹn thứ 5" | Card hiện đúng dòng `[DD/MM] HR hẹn thứ 5` dạng mono |
| 4 | Đọc câu trả lời của agent sau (3) | Agent nói **1 câu**, **không** dán JSON |
| 5 | Đổi tab Insight rồi về Chat | Card cũ vẫn còn, không bị vẽ lại / mất state |
| 6 | Rời `/applications` sang `/jobs` rồi quay lại | Console sạch; card cũ mất cùng history (defect thread đã biết) |

- [ ] **Step 3: Dọn dữ liệu test**

```bash
docker exec talentpulse-postgres psql -U admin -d warehouse -c \
  "update app.job_applications set status='saved' where title='Business Analyst' and user_id='e75736a6-98d9-4a1c-89f6-773521062b64';" -c \
  "update app.job_applications set notes=null where user_id='e75736a6-98d9-4a1c-89f6-773521062b64';"
```

- [ ] **Step 4: Gate cuối**

```bash
cd apps/frontend && npx tsc --noEmit && npm test
```
Expected: tất cả xanh.

---

## Ngoài phạm vi plan này

- Card cho `add_application` và `start_interview_prep` (spec §6 xếp giai đoạn C) — làm sau khi 2 card đầu chạy thật.
- **Human-in-the-loop** cho `add_application` — đảo ngược quyết định "không hỏi + Hoàn tác" của v1, cần quyết định riêng của user. Nếu làm: nhánh Huỷ **bắt buộc** gọi `respond(...)`, không gọi là treo thread vĩnh viễn.
- A2UI — spec §7 đã loại kèm lý do.
- **Defect đã biết:** chat dock rỗng sau reload (`GET /api/agent/threads/dock-<userId>/messages` → 404). Card làm nó lộ rõ hơn nhưng không thuộc plan này.
