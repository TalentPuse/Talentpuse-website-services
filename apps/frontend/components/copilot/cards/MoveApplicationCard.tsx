"use client";
import type { DockToolCardProps } from "../copilot-bridge";
import { STATUS_LABEL } from "@/components/applications/StatusSelect";
import type { ApplicationStatus } from "@/lib/api";

/**
 * Card cho tool `move_application`.
 *
 * Chỉ đọc `parameters` + `result` — KHÔNG đụng vào state của trang. Renderer
 * sống dai hơn trang /applications (useRenderTool không tự dọn), nên giữ ref
 * tới state page sẽ rò rỉ.
 *
 * `parameters` KHÔNG được zod validate (runtime chỉ partialJSONParse) nên mọi
 * field có thể thiếu — kể cả khi status="complete". Guard từng field.
 *
 * KHÔNG có nút "Hoàn tác": registration truyền đúng `DockToolCardProps` (bridge
 * tự định nghĩa, không có `onUndo`) — hoàn tác cho move_application đã có sẵn
 * qua toast (`toastWithUndo` trong BoardCopilot), một nút thứ hai ở đây sẽ
 * không bao giờ nhận được callback thật.
 */
export default function MoveApplicationCard({
  parameters,
  status,
  result,
}: DockToolCardProps) {
  const cardName = typeof parameters.card === "string" ? parameters.card : null;
  const target = typeof parameters.status === "string" ? parameters.status : null;
  const targetLabel = target
    ? target in STATUS_LABEL
      ? STATUS_LABEL[target as ApplicationStatus]
      : target
    : null;

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
    </div>
  );
}
