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
    const out = await registered.get("add_application")!({ title: "AI Engineer" });
    expect(applicationsApi.create).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("chưa đăng nhập");
  });

  it("trả lỗi khi applicationsApi.create thất bại", async () => {
    applicationsApi.create.mockRejectedValueOnce(new Error("network down"));
    const b = board();
    render(<BoardCopilot board={b} />);
    const out = await registered.get("add_application")!({ title: "AI Engineer" });
    expect(out.toLowerCase()).not.toContain("đã thêm");
    expect(out.toLowerCase()).toContain("lỗi");
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

  it("KHÔNG gọi API khi chưa đăng nhập (token null)", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" })], token: null });
    render(<BoardCopilot board={b} />);
    const out = await registered.get("append_note")!({ card: "Data Analyst", note: "x" });
    expect(applicationsApi.update).not.toHaveBeenCalled();
    expect(out.toLowerCase()).toContain("chưa đăng nhập");
  });

  it("trả lỗi khi applicationsApi.update thất bại", async () => {
    applicationsApi.update.mockRejectedValueOnce(new Error("network down"));
    const b = board({ apps: [app({ id: "a", title: "Data Analyst" })] });
    render(<BoardCopilot board={b} />);
    const out = await registered.get("append_note")!({ card: "Data Analyst", note: "x" });
    expect(out.toLowerCase()).not.toContain("đã thêm ghi chú");
    expect(out.toLowerCase()).toContain("lỗi");
  });

  it("undo của append_note gọi applicationsApi.update trả lại notes cũ", async () => {
    const b = board({ apps: [app({ id: "a", title: "Data Analyst", notes: "ghi chú cũ" })] });
    render(<BoardCopilot board={b} />);
    await registered.get("append_note")!({ card: "Data Analyst", note: "HR hẹn vòng 2" });
    const undo = toastWithUndo.mock.calls[0][1] as () => Promise<void>;
    await undo();
    expect(applicationsApi.update).toHaveBeenCalledWith("tok", "a", { notes: "ghi chú cũ" });
  });
});
