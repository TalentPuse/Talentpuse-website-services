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
