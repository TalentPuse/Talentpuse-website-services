import { render } from "@testing-library/react";
import BoardCopilot from "../BoardCopilot";
import type { BoardData } from "@/app/applications/use-board-data";
import type { Application } from "@/lib/api";

// Task 3: handler giờ có thể trả object (card giàu) thay vì chỉ chuỗi — Map
// phải nới theo union này để lưu được handler mới của append_note.
const registered = new Map<
  string,
  (a: Record<string, unknown>) => Promise<string | Record<string, unknown>>
>();
jest.mock("../copilot-bridge", () => ({
  useDockTool: (tool: {
    name: string;
    handler: (a: Record<string, unknown>) => Promise<string | Record<string, unknown>>;
  }) => {
    registered.set(tool.name, tool.handler);
  },
  useDockContext: () => undefined,
  // Task 2: BoardCopilot giờ còn gọi useDockToolCard để đăng ký card cho
  // move_application. Test file này chỉ quan tâm hành vi của tool handler,
  // không quan tâm card UI, nên stub thành no-op.
  useDockToolCard: () => undefined,
}));
jest.mock("../undo-toast", () => ({ toastWithUndo: jest.fn() }));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
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
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toastWithUndo } = require("../undo-toast") as { toastWithUndo: jest.Mock };

/**
 * move_application / add_application / start_interview_prep vẫn LUÔN trả
 * chuỗi sau Task 3 — chỉ nhánh thành công của append_note đổi thành object.
 * `registered` giờ là Map dùng chung một kiểu union cho mọi handler, nên các
 * test còn lại của những tool đó cần thu hẹp `out` về string trước khi gọi
 * các method chỉ string mới có (`.toLowerCase()`...). Dùng typeof-narrow
 * (không ép kiểu `as string`) để tsc tự xác nhận, không phải tin lời hứa.
 */
function expectStringResult(out: string | Record<string, unknown>): string {
  if (typeof out !== "string") throw new Error("expected string result, got object");
  return out;
}

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
    const out = expectStringResult(await registered.get("move_application")!({ card: "kubernetes", status: "offer" }));
    expect(b.changeStatus).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("không tìm thấy");
  });

  it("không đăng ký tool xoá", () => {
    render(<BoardCopilot board={board()} />);
    expect([...registered.keys()].some((k) => /delete|remove/.test(k))).toBe(false);
  });
});

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
    const out = expectStringResult(await registered.get("add_application")!({ status: "applied" }));
    expect(applicationsApi.create).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("tên job");
  });

  it("KHÔNG gửi source / source_job_id lên applicationsApi.create", async () => {
    const b = board();
    render(<BoardCopilot board={b} />);
    await registered.get("add_application")!({ title: "AI Engineer", company: "VNG", status: "applied" });
    const body = applicationsApi.create.mock.calls[0][1];
    expect(body).not.toHaveProperty("source");
    expect(body).not.toHaveProperty("source_job_id");
  });

  it("KHÔNG gọi API khi chưa đăng nhập (token null)", async () => {
    const b = board({ token: null });
    render(<BoardCopilot board={b} />);
    const out = expectStringResult(await registered.get("add_application")!({ title: "AI Engineer" }));
    expect(applicationsApi.create).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("chưa đăng nhập");
  });

  it("trả lỗi khi applicationsApi.create thất bại", async () => {
    applicationsApi.create.mockRejectedValueOnce(new Error("network down"));
    const b = board();
    render(<BoardCopilot board={b} />);
    const out = expectStringResult(await registered.get("add_application")!({ title: "AI Engineer" }));
    expect(out.toLowerCase()).not.toContain("đã thêm");
    expect(out.toLowerCase()).toContain("lỗi");
  });

  it("khi applicationsApi.create thất bại thì KHÔNG reload và KHÔNG hiện toast hoàn tác", async () => {
    applicationsApi.create.mockRejectedValueOnce(new Error("network down"));
    const b = board();
    render(<BoardCopilot board={b} />);
    await registered.get("add_application")!({ title: "AI Engineer" });
    expect(b.reload).not.toHaveBeenCalled();
    expect(toastWithUndo).not.toHaveBeenCalled();
  });

  it("nhận salary_million dạng chuỗi số và ép thành number trước khi gửi create", async () => {
    const b = board();
    render(<BoardCopilot board={b} />);
    await registered.get("add_application")!({ title: "AI Engineer", salary_million: "25" });
    const body = applicationsApi.create.mock.calls[0][1];
    expect(body.salary_million).toBe(25);
    expect(typeof body.salary_million).toBe("number");
  });

  it("undo của add_application gọi applicationsApi.remove với đúng id card vừa tạo", async () => {
    applicationsApi.create.mockResolvedValueOnce({ id: "new-99", title: "AI Engineer" });
    const b = board();
    render(<BoardCopilot board={b} />);
    await registered.get("add_application")!({ title: "AI Engineer" });
    const undo = toastWithUndo.mock.calls[0][1] as () => Promise<void>;
    await undo();
    expect(applicationsApi.remove).toHaveBeenCalledWith("tok", "new-99");
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

  it("Task 3: khi thành công trả về OBJECT với message, card và line đã đóng dấu ngày", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: null })] });
    render(<BoardCopilot board={b} />);
    const out = await registered.get("append_note")!({ card: "Data Analyst", note: "HR hẹn vòng 2" });

    if (typeof out === "string") throw new Error("kỳ vọng object, handler vẫn trả chuỗi");
    expect(out.message).toBe('Đã thêm ghi chú vào "Data Analyst".');
    expect(out.card).toBe("Data Analyst");

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    expect(out.line).toBe(`[${dd}/${mm}] HR hẹn vòng 2`);
  });

  it("KHÔNG gọi API khi chưa đăng nhập (token null)", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" })], token: null });
    render(<BoardCopilot board={b} />);
    const out = expectStringResult(await registered.get("append_note")!({ card: "Data Analyst", note: "x" }));
    expect(applicationsApi.update).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("chưa đăng nhập");
  });

  it("trả lỗi khi applicationsApi.update thất bại", async () => {
    applicationsApi.update.mockRejectedValueOnce(new Error("network down"));
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" })] });
    render(<BoardCopilot board={b} />);
    const out = expectStringResult(await registered.get("append_note")!({ card: "Data Analyst", note: "x" }));
    expect(out.toLowerCase()).not.toContain("đã thêm ghi chú");
    expect(out.toLowerCase()).toContain("lỗi");
  });

  it("khi applicationsApi.update thất bại thì KHÔNG reload và KHÔNG hiện toast hoàn tác", async () => {
    applicationsApi.update.mockRejectedValueOnce(new Error("network down"));
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "x" });
    expect(b.reload).not.toHaveBeenCalled();
    expect(toastWithUndo).not.toHaveBeenCalled();
  });

  it("undo của append_note gọi applicationsApi.update trả lại notes cũ", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: "ghi chú cũ" })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "HR hẹn vòng 2" });
    const undo = toastWithUndo.mock.calls[0][1] as () => Promise<void>;
    await undo();
    expect(applicationsApi.update).toHaveBeenCalledWith("tok", "a", { notes: "ghi chú cũ" });
  });

  it("undo của append_note khi card trước đó chưa có ghi chú (notes null) khôi phục về notes rỗng", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: null })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "note A" });
    const undo = toastWithUndo.mock.calls[0][1] as () => Promise<void>;
    await undo();
    expect(applicationsApi.update).toHaveBeenLastCalledWith("tok", "a", { notes: "" });
  });

  it("undo của lần append_note ĐẦU TIÊN chỉ xoá dòng của nó, giữ nguyên ghi chú thêm SAU đó (regression Finding 1)", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: null })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "note A" });
    await registered.get("append_note")!({ card: "Data Analyst", note: "note B" });

    // Toast của lần append đầu (note A) vẫn còn hiển thị khi user bấm Hoàn tác,
    // dù note B đã được thêm sau đó — undo A không được phép xoá mất note B.
    const undoA = toastWithUndo.mock.calls[0][1] as () => Promise<void>;
    await undoA();

    const lastPatch = applicationsApi.update.mock.calls[applicationsApi.update.mock.calls.length - 1][2];
    expect(lastPatch.notes).not.toContain("note A");
    expect(lastPatch.notes).toContain("note B");
  });

  it("undo của append_note không làm gì (không gọi API) nếu dòng đã thêm không còn nguyên vẹn trong notes hiện tại", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: null })] });
    const { rerender } = render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "note A" });
    const undo = toastWithUndo.mock.calls[0][1] as () => Promise<void>;

    // Dữ liệu thật đổi khác hẳn (vd: user tự sửa notes ở nơi khác) — không
    // còn chứa dòng mà lần append này đã thêm.
    rerender(
      <BoardCopilot
        board={board({ apps: [app({ id: "a", title: "Data Analyst", notes: "đã bị sửa bởi nơi khác" })] })}
      />,
    );
    applicationsApi.update.mockClear();

    await undo();
    expect(applicationsApi.update).not.toHaveBeenCalled();
  });
});

describe("BoardCopilot / start_interview_prep", () => {
  beforeEach(() => { registered.clear(); jest.clearAllMocks(); });

  it("điều hướng tới /interview với role đã encode", async () => {
    const b = board({ apps: [app({ id: "a", title: "AI ＆DATA Scientist/Databricks" })] });
    render(<BoardCopilot board={b} />);
    const out = await registered.get("start_interview_prep")!({ card: "databricks" });
    expect(mockPush).toHaveBeenCalledWith(
      `/interview?role=${encodeURIComponent("AI ＆DATA Scientist/Databricks")}`,
    );
    expect(out).toContain("AI ＆DATA Scientist/Databricks");
  });

  it("KHÔNG điều hướng khi không tìm thấy card", async () => {
    render(<BoardCopilot board={board()} />);
    const out = expectStringResult(await registered.get("start_interview_prep")!({ card: "kubernetes" }));
    expect(mockPush).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("không tìm thấy");
  });

  it("KHÔNG điều hướng khi nhập nhằng, trả candidates", async () => {
    const b = board({
      apps: [
        app({ id: "a", title: "Data Analyst", company_name: "X" }),
        app({ id: "b", title: "Data Engineer", company_name: "Y" }),
      ],
    });
    render(<BoardCopilot board={b} />);
    const out = await registered.get("start_interview_prep")!({ card: "data" });
    expect(mockPush).not.toHaveBeenCalled();
    expect(out).toContain("Data Analyst");
    expect(out).toContain("Data Engineer");
  });

  it("KHÔNG gọi API ghi nào", async () => {
    const b = board();
    render(<BoardCopilot board={b} />);
    await registered.get("start_interview_prep")!({ card: "Data Analyst" });
    expect(applicationsApi.update).not.toHaveBeenCalled();
    expect(applicationsApi.create).not.toHaveBeenCalled();
    expect(applicationsApi.remove).not.toHaveBeenCalled();
    expect(b.changeStatus).not.toHaveBeenCalled();
  });
});
