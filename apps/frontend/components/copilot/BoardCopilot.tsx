"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
 * Gỡ đúng MỘT dòng `line` khỏi `text` nếu dòng đó còn nguyên vẹn trong đó,
 * dù nó nằm ở đầu, giữa, hay cuối chuỗi ghi chú. Trả về `null` khi không tìm
 * thấy — gọi nơi dùng phải hiểu `null` là "không đoán, không ghi gì cả",
 * KHÔNG được coi null như chuỗi rỗng.
 */
function removeNoteLine(text: string | null, line: string): string | null {
  const current = text ?? "";
  if (current === line) return "";
  if (current.startsWith(`${line}\n`)) return current.slice(line.length + 1);
  if (current.endsWith(`\n${line}`)) return current.slice(0, current.length - line.length - 1);
  const marker = `\n${line}\n`;
  const idx = current.indexOf(marker);
  if (idx !== -1) return current.slice(0, idx) + "\n" + current.slice(idx + marker.length);
  return null;
}

/**
 * Null-render: chỉ đăng ký context + tool cho agent, không vẽ gì.
 *
 * CHỈ được render khi `COPILOT_DOCK` bật — nó gọi hook của CopilotKit nên
 * phải nằm trong `<CopilotKit>` mà CopilotDockProvider chỉ dựng khi flag bật.
 */
export default function BoardCopilot({ board }: { board: BoardData }): null {
  const { apps, changeStatus } = board;
  const router = useRouter();

  // Ref luôn trỏ tới `apps` mới nhất. Handler của tool và callback undo được
  // tạo ra ở MỘT lần render nhưng có thể chạy ở nhiều render sau đó (undo có
  // thể bấm sau vài giây, hoặc sau khi agent đã gọi tool khác) — nếu đọc biến
  // `apps` bắt từ closure của render lúc tạo, đó là dữ liệu cũ. Đọc qua ref là
  // cách để luôn thấy bản mới nhất tại đúng thời điểm handler thực thi.
  const appsRef = useRef(apps);
  // Ghi đè cục bộ notes theo card id: `board.reload()` chỉ đưa dữ liệu mới về
  // qua prop `apps` ở lần render kế — trong lúc đó (ví dụ: append lần 2 chạy
  // ngay sau append lần 1, hoặc user bấm Hoàn tác trước khi reload tới), đọc
  // thẳng `apps` vẫn ra bản CŨ. Bản ghi đè này là nguồn "mới nhất" thực sự
  // ngay sau mỗi lần chính component này tự ghi thành công.
  const notesOverrideRef = useRef(new Map<string, string | null>());

  useEffect(() => {
    appsRef.current = apps;
    // `apps` đổi nghĩa là board đã có dữ liệu thật mới (reload thật sự chạy
    // xong, hoặc user sửa notes bằng tay ở nơi khác) — dữ liệu đó luôn đáng
    // tin hơn phỏng đoán cục bộ, nên xoá sạch override để dùng lại `apps`.
    notesOverrideRef.current.clear();
  }, [apps]);

  /** Notes mới nhất biết được cho một card: ưu tiên override cục bộ, sau đó mới tới `apps`. */
  function latestNotes(cardId: string, fallback: string | null): string | null {
    if (notesOverrideRef.current.has(cardId)) return notesOverrideRef.current.get(cardId) ?? null;
    const fresh = appsRef.current.find((a) => a.id === cardId);
    return fresh ? fresh.notes : fallback;
  }

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
      "(e.g. got an interview, got an offer, was rejected). " +
      "IMPORTANT: pass the `card` argument exactly as the user phrased it — do not " +
      "resolve it to a specific title yourself, even if the board context makes one " +
      "candidate seem likely. This tool matches `card` against the board and returns " +
      "a list of candidates if more than one card matches. Calling the tool with the " +
      "user's ambiguous wording is correct; it is the tool's job to detect ambiguity " +
      "and yours to relay the resulting question to the user, not to guess for them.",
    parameters: [
      { name: "card", type: "string", required: true,
        description: "The user's own wording for which card they mean — copy it " +
          "verbatim (a word, phrase, or the exact id from context). Do not upgrade it " +
          "to a full or corrected job title based on what you see on the board: if the " +
          "wording could match several cards, passing it unresolved is what lets this " +
          "tool return the candidates so the user can be asked which one." },
      { name: "status", type: "string", required: true, enum: STATUSES,
        description: "Target column." },
    ],
    handler: async (args) => {
      const query = String(args.card ?? "");
      const status = String(args.status ?? "") as ApplicationStatus;
      if (!STATUSES.includes(status)) return `Trạng thái "${status}" không hợp lệ.`;

      // Dùng appsRef (không phải `apps` chụp lúc render) — cùng lý do với
      // append_note: handler này có thể chạy ở lượt render sau, đọc `apps`
      // đóng gói lúc tạo sẽ ra dữ liệu cũ.
      const found = resolveCard(appsRef.current, query);
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

      // Model có thể gửi salary dạng chuỗi ("25" thay vì 25) — ép kiểu bằng
      // Number() thay vì chỉ chấp nhận typeof number, để không âm thầm làm
      // rớt lương mà vẫn báo "thêm thành công" cho user. Nếu có giá trị
      // nhưng không ép được thành số hữu hạn, báo rõ trong message trả về
      // cho agent để agent còn biết đường nói lại cho user.
      let salaryValue: number | undefined;
      let salaryWarning = "";
      if (args.salary_million !== undefined && args.salary_million !== null && args.salary_million !== "") {
        const coerced = Number(args.salary_million);
        if (Number.isFinite(coerced)) {
          salaryValue = coerced;
        } else {
          salaryWarning = ` (không lưu được mức lương "${String(args.salary_million)}" — giá trị không hợp lệ, báo user nhập lại)`;
        }
      }

      // Không truyền source/source_job_id ⇒ backend đặt source = "manual" và
      // source_job_id = NULL. Partial unique index (user_id, source,
      // source_job_id) WHERE source_job_id IS NOT NULL nên card thêm bằng lời
      // không bao giờ đụng constraint, cũng không gộp nhầm với card từ job board.
      try {
        const created = await applicationsApi.create(board.token, {
          title,
          company_name: args.company ? String(args.company) : undefined,
          city: args.city ? String(args.city) : undefined,
          salary_million: salaryValue,
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
        return `Đã thêm "${title}" vào cột ${status}.${salaryWarning}`;
      } catch {
        return `Không thêm được "${title}" — API lỗi. Báo user thử lại.`;
      }
    },
  });

  useDockTool({
    name: "append_note",
    description:
      "Append a short note to a job application card — interview dates, recruiter " +
      "names, next steps. Notes are appended, never replaced. " +
      "IMPORTANT: pass the `card` argument exactly as the user phrased it — do not " +
      "resolve it to a specific title yourself. This tool matches `card` against the " +
      "board and returns a list of candidates if more than one card matches. Calling " +
      "the tool with the user's ambiguous wording is correct; it is the tool's job to " +
      "detect ambiguity and yours to relay the resulting question to the user, not to " +
      "guess for them.",
    parameters: [
      { name: "card", type: "string", required: true,
        description: "The user's own wording for which card they mean — copy it " +
          "verbatim (a word, phrase, or the exact id from context). Do not upgrade it " +
          "to a full or corrected job title based on what you see on the board: if the " +
          "wording could match several cards, passing it unresolved is what lets this " +
          "tool return the candidates so the user can be asked which one." },
      { name: "note", type: "string", required: true, description: "The note text to append." },
    ],
    handler: async (args) => {
      const query = String(args.card ?? "");
      const note = String(args.note ?? "").trim();
      if (!note) return "Ghi chú rỗng, không có gì để lưu.";
      if (!board.token) return "Chưa đăng nhập, không ghi được.";

      // Dùng appsRef (không phải biến `apps` chụp lúc render) để khớp card
      // trên dữ liệu mới nhất có thể — giảm rủi ro đọc phải bản cũ khi có
      // nhiều lệnh append_note gọi liên tiếp trong cùng một lượt của agent.
      const found = resolveCard(appsRef.current, query);
      if (!found.ok) {
        return found.reason === "not_found"
          ? `Không tìm thấy card nào khớp "${query}".`
          : `Có nhiều card khớp "${query}", hỏi lại user:\n${describeCandidates(found.candidates)}`;
      }

      const card = found.card;
      const line = `${noteStamp()} ${note}`;
      // NỐI THÊM, không đè: ghi chú user tự viết là dữ liệu không tái tạo được.
      // `before` đọc qua latestNotes() — ưu tiên override cục bộ nếu có — chứ
      // không phải card.notes chụp lúc resolveCard, vì card.notes vẫn có thể
      // là bản cũ nếu một append_note khác vừa chạy xong ngay trước đó.
      const before = latestNotes(card.id, card.notes);
      const next = before ? `${before}\n${line}` : line;
      try {
        await applicationsApi.update(board.token, card.id, { notes: next });
        await board.reload();
      } catch {
        return `Không lưu được ghi chú cho "${card.title}" — API lỗi.`;
      }
      notesOverrideRef.current.set(card.id, next);

      toastWithUndo(`Đã ghi chú vào "${card.title}"`, async () => {
        if (!board.token) return;
        // QUAN TRỌNG — đây là chỗ sửa lỗi mất ghi chú: không phục hồi nguyên
        // field `notes` về snapshot `before` chụp lúc tạo toast này (closure
        // có thể chạy vài giây/nhiều lượt append sau, lúc đó `before` đã lỗi
        // thời). Thay vào đó đọc notes MỚI NHẤT ngay tại thời điểm bấm Hoàn
        // tác rồi chỉ gỡ đúng DÒNG mà lần append này đã thêm. Nếu dòng đó
        // không còn nguyên vẹn trong đó nữa (đã bị đổi/gỡ bằng cách khác) thì
        // không làm gì cả — thà không hoàn tác còn hơn đoán bừa và xoá nhầm
        // ghi chú của lần append khác.
        const current = latestNotes(card.id, next);
        const restored = removeNoteLine(current, line);
        if (restored === null) return;
        await applicationsApi.update(board.token, card.id, { notes: restored });
        notesOverrideRef.current.set(card.id, restored);
        await board.reload();
      });
      return `Đã thêm ghi chú vào "${card.title}".`;
    },
  });

  useDockTool({
    name: "start_interview_prep",
    description:
      "Open the mock-interview page pre-filled for one job on the user's board. Use when the " +
      "user wants to practise or prepare for an interview for a specific job they are tracking. " +
      "This only navigates and pre-fills the target role — it does NOT start the interview; " +
      "the user still picks technical or behavioural on that page.",
    parameters: [
      { name: "card", type: "string", required: true,
        description: "The user's own wording for which card they mean — copy it verbatim " +
          "(a word, phrase, company name, abbreviation, or the exact id from context). Do not " +
          "upgrade it to a full or corrected job title based on what you see on the board: if " +
          "the wording could match more than one card, calling this tool with that exact " +
          "wording is correct, because the tool returns the candidate list to ask the user with." },
    ],
    handler: async (args) => {
      const query = String(args.card ?? "");
      const found = resolveCard(appsRef.current, query);
      if (!found.ok) {
        return found.reason === "not_found"
          ? `Không tìm thấy card nào khớp "${query}". Hỏi user xem họ muốn nói job nào.`
          : `Có nhiều card khớp "${query}", hỏi lại user chọn cái nào:\n${describeCandidates(found.candidates)}`;
      }
      // Chỉ điều hướng, KHÔNG tạo session: API cần `mode` (technical|behavioral)
      // mà dock không biết user muốn gì. Tạo session ở đây sẽ phải đoán hộ và
      // để lại session mồ côi mỗi lần user đổi ý.
      const card = found.card;
      router.push(`/interview?role=${encodeURIComponent(card.title)}`);
      return `Đã mở trang luyện phỏng vấn cho "${card.title}". User chọn chế độ technical hoặc behavioral ở đó.`;
    },
  });

  return null;
}
