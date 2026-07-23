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
