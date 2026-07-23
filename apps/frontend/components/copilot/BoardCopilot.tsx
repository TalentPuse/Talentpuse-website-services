"use client";
import type { BoardData } from "@/app/applications/use-board-data";
import { applicationsApi } from "@/lib/api";
import type { ApplicationStatus } from "@/lib/api";
import { useDockContext, useDockTool } from "./copilot-bridge";
import { describeCandidates, resolveCard } from "./resolve-card";
import { toastWithUndo } from "./undo-toast";

const STATUSES: ApplicationStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Tem ngày `[DD/MM]` đứng đầu mỗi dòng ghi chú AI thêm vào. */
function noteStamp(): string {
  const d = new Date();
  return `[${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}]`;
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

  return null;
}
