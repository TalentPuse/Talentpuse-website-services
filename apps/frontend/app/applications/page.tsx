"use client";
import { ClipboardCheck } from "@/lib/icons";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ForceTheme } from "@/components/theme/ForceTheme";
import { Skeleton } from "@/components/ui/skeleton";
import ApplicationBoard from "@/components/applications/ApplicationBoard";
import AddApplicationDialog from "@/components/applications/AddApplicationDialog";
import CopilotDockProvider from "@/components/copilot/CopilotDockProvider";
import BoardCopilot from "@/components/copilot/BoardCopilot";
import DockInsight from "@/components/copilot/DockInsight";
import { COPILOT_DOCK } from "@/lib/flags";
import type { ApplicationStatus } from "@/lib/api";
import { useBoardData, type BoardData } from "./use-board-data";

export default function ApplicationsPage() {
  const board = useBoardData();
  return (
    <DashboardLayout>
      <ForceTheme theme="light" />
      <CopilotDockProvider page="applications" insight={<DockInsight board={board} />}>
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
