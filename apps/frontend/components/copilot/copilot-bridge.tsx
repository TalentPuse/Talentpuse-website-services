"use client";

/**
 * Copilot Dock bridge — the ONLY file in the codebase allowed to import
 * CopilotKit's frontend-tool/context hooks directly. Every dock feature
 * (Task 2+) must go through `useDockTool` / `useDockContext` below so the
 * lib's real API stays swappable behind one wrapper.
 *
 * ── API discovery trail (installed @copilotkit/react-core@1.62.3) ──────────
 *
 * `grep -o "useFrontendTool\|useCopilotAction\|useHumanInTheLoop\|addContext\|
 * useAgentContext\|useCopilotReadable" node_modules/@copilotkit/react-core/
 * dist/*.d.mts node_modules/@copilotkit/react-core/dist/v2/*.d.mts` shows
 * `useFrontendTool` and `useAgentContext` are the v2 hooks (v1 barrel
 * `dist/index.d.mts` only has the legacy `useCopilotAction` /
 * `useCopilotReadable` names — NOT what we want, this dock is built on v2
 * like CopilotChatSurface.tsx). Both are re-exported from
 * "@copilotkit/react-core/v2" (`dist/v2/index.d.mts`: `... useAgentContext,
 * ... useFrontendTool ...` in the final `export { ... }` list, sourced from
 * `../copilotkit-Bp6BD8xe.mjs`).
 *
 * Real signatures, read from `dist/copilotkit-Bp6BD8xe.d.mts`:
 *
 *   // region "src/v2/hooks/use-frontend-tool.d.ts"
 *   declare function useFrontendTool<T extends Record<string, unknown> = Record<string, unknown>>(
 *     tool: ReactFrontendTool<T>,
 *     deps?: ReadonlyArray<unknown>,
 *   ): void;
 *   // region "src/v2/types/frontend-tool.d.ts"
 *   type ReactFrontendTool<T> = FrontendTool<T> & { render?: ReactToolCallRenderer<T>["render"] };
 *   // FrontendTool<T> (node_modules/@copilotkit/core/dist/index.d.mts):
 *   //   { name: string; description?: string; parameters?: StandardSchemaV1<any, T>;
 *   //     handler?: (args: T, context: FrontendToolHandlerContext) => Promise<unknown>;
 *   //     followUp?: boolean; agentId?: string; available?: boolean }
 *   //
 *   // region "src/v2/hooks/use-agent-context.d.ts"
 *   interface AgentContextInput { description: string; value: JsonSerializable }
 *   declare function useAgentContext(context: AgentContextInput): void;
 *
 * Key fact that shapes the wrappers below: `FrontendTool.parameters` is a
 * *Standard Schema* (`~standard` interface from `@standard-schema/spec`, the
 * shape Zod/Valibot/ArkType all implement), NOT a plain param-descriptor
 * array. `buildParameterSchema()` below builds a REAL `zod` schema
 * (`z.object({...})`) from `DockToolParam[]` — required, not optional:
 * runtime verification (browser round-trip test) showed a hand-rolled
 * `~standard` object that only implements schema *validation* is not
 * enough. Tracing `node_modules/@copilotkit/core/dist/index.mjs`
 * (`createToolSchema`) → `node_modules/@copilotkit/shared/dist/
 * standard-schema.mjs` (`schemaToJsonSchema`) shows the runtime also needs
 * to ship the tool's parameters to the agent as JSON Schema, via one of:
 *   1. the schema natively implements Standard **JSON** Schema V1
 *      (`~standard.jsonSchema.input()` — Zod v4 core does, classic Zod
 *      v3 does not),
 *   2. a `schema.toJSONSchema()` method (Zod v4 classic), or
 *   3. `schema["~standard"].vendor === "zod"`, in which case CopilotKit
 *      falls back to its own bundled `zod-to-json-schema` package (already
 *      a dependency of `@copilotkit/react-core`, and it wires this up
 *      automatically — see `createToolSchema` in `@copilotkit/core`'s
 *      bundle: `schemaToJsonSchema(tool.parameters, { zodToJsonSchema })`).
 * A hand-rolled validator's `vendor` string (whatever we pick) never equals
 * `"zod"`, so path 3 never triggers and `schemaToJsonSchema` throws
 * ("does not implement Standard JSON Schema V1 and no zodToJsonSchema
 * fallback is available"), which is exactly the runtime error hit on
 * `/jobs`. A real zod schema's `~standard.vendor` is the literal `"zod"`
 * (`node_modules/zod/src/v3/types.ts:439`), so building one here — using
 * the SAME `zod` package instance CopilotKit itself imports — makes path 3
 * apply and the conversion succeed. `zod` is a direct dependency of this
 * package (see `package.json`), pinned to `^3.25.76` to match the version
 * already resolved in the tree (`node_modules/zod`), comfortably above the
 * `>=3.24` floor where Zod added Standard Schema support, and satisfying
 * `@copilotkit/react-core`'s own `"zod": ">=3.0.0"` peer dependency.
 *
 * Registration-refresh behavior verified from the bundled implementation
 * (`dist/copilotkit-ympAovXs.mjs`, region "src/v2/hooks/use-frontend-tool.tsx"):
 * `useFrontendTool` re-registers inside a `useEffect` keyed on
 * `[tool.name, tool.available, copilotkit, JSON.stringify(deps)]` — the
 * `handler`/`parameters` closures captured at registration time are NOT
 * automatically refreshed just because a caller re-renders with a new inline
 * object. `useDockTool` compensates with a `handlerRef` so the latest
 * `handler` always runs even between registration refreshes, and forwards
 * `[description, JSON.stringify(parameters)]` as `deps` so a real shape
 * change still triggers re-registration.
 * `useAgentContext` (same bundle, region "src/v2/hooks/use-agent-context.tsx")
 * stringifies `value` itself before diffing, so passing a fresh sanitized
 * object every render is safe — the effect only reruns when the JSON content
 * actually changes.
 */

import { useMemo, useRef } from "react";
import { z } from "zod";
import {
  useFrontendTool,
  useAgentContext,
  useRenderTool,
  type FrontendTool,
  type JsonSerializable,
} from "@copilotkit/react-core/v2";

export type DockToolParam = {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required?: boolean;
  enum?: string[];
};

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

/** The exact shape `FrontendTool.parameters` requires — a Standard Schema V1. */
type FrontendToolParameters = NonNullable<FrontendTool["parameters"]>;

/**
 * Build a real `zod` object schema from `DockToolParam[]` — see file header
 * for why this must be an actual zod schema (not a hand-rolled `~standard`
 * object) for CopilotKit to ship the tool's parameters to the agent as JSON
 * Schema.
 */
function buildParameterSchema(parameters: DockToolParam[]): FrontendToolParameters {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const param of parameters) {
    let field: z.ZodTypeAny =
      param.type === "string"
        ? param.enum && param.enum.length > 0
          ? z.enum(param.enum as [string, ...string[]])
          : z.string()
        : param.type === "number"
          ? z.number()
          : z.boolean();

    field = field.describe(param.description);
    if (!param.required) field = field.optional();

    shape[param.name] = field;
  }
  return z.object(shape) as unknown as FrontendToolParameters;
}

/**
 * Register (or refresh) a dock tool the agent can call. Wraps
 * `useFrontendTool` from "@copilotkit/react-core/v2" — see file header for
 * the real hook signature and why a `handlerRef` is needed.
 */
export function useDockTool(tool: DockTool): void {
  const handlerRef = useRef(tool.handler);
  handlerRef.current = tool.handler;

  const parametersKey = JSON.stringify(tool.parameters);

  const parameterSchema = useMemo(
    () => buildParameterSchema(tool.parameters),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parametersKey is the intentional content-based dep
    [parametersKey],
  );

  useFrontendTool<Record<string, unknown>>(
    {
      name: tool.name,
      description: tool.description,
      parameters: parameterSchema,
      handler: async (args) => handlerRef.current(args),
    },
    [tool.description, parametersKey],
  );
}

/** JSON round-trip so arbitrary caller values are safe to hand to `useAgentContext`. */
function toJsonSerializable(value: unknown): JsonSerializable {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as JsonSerializable;
  } catch {
    return String(value);
  }
}

/**
 * Publish read-only context the agent can see (e.g. current filters, current
 * page). Wraps `useAgentContext` from "@copilotkit/react-core/v2".
 */
export function useDockContext(description: string, value: unknown): void {
  useAgentContext({ description, value: toJsonSerializable(value) });
}

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
      // `useRenderTool`'s named-renderer overload types `render` as
      // `(props: RenderToolProps<S>) => React.ReactElement`, inferred from
      // `parameters: S`. `Component` is typed against our own loose
      // `DockToolCardProps`, not the library's inferred `RenderToolProps<S>`,
      // so a direct assignment doesn't structurally match. A `(props: never)
      // => ...` cast (function contravariance: a param type must be a
      // SUPERtype of the target's declared param type for the assignment to
      // be valid, and `never` is a subtype of everything, so it satisfies
      // nothing) does NOT fix this — confirmed by tsc still erroring with
      // that cast. `any` is the correct escape hatch here: a function typed
      // `(props: any) => X` is assignable to any `(props: T) => X`.
      render: Component as unknown as (props: any) => React.ReactElement,
    },
    [card.name, parametersKey],
  );

  // CỐ Ý KHÔNG dọn renderer khi unmount. `useRenderTool` giữ lại entry theo
  // thiết kế — doc của chính hook ghi "keeps renderer entries on cleanup so
  // historical chat tool calls can still render". Dock mount toàn cục còn
  // BoardCopilot chỉ mount ở /applications, nên dọn đi sẽ làm card cũ trong
  // lịch sử chat rơi về render mặc định. Card này thuần (chỉ đọc props, không
  // giữ ref tới state trang) nên phần giữ lại là bounded và vô hại.
}
