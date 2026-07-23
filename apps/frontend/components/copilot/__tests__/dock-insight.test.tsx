import { render, waitFor } from "@testing-library/react";
import DockInsight from "../DockInsight";
import type { BoardData } from "@/app/applications/use-board-data";
import type { Application } from "@/lib/api";

const SUMMARY_KEY = "tp_dock_summary";

jest.mock("@/lib/api", () => ({
  applicationsApi: {
    aiSummary: jest.fn(),
  },
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { applicationsApi } = require("@/lib/api") as {
  applicationsApi: { aiSummary: jest.Mock };
};

function app(over: Partial<Application>): Application {
  return {
    id: "id-1", source: "linkedin", source_job_id: null, title: "Data Analyst",
    company_name: null, city: null, source_url: null, salary_million: null,
    status: "applied", applied_at: null, notes: null, created_at: "2026-07-01T00:00:00",
    ...over,
  };
}

function board(over: Partial<BoardData> = {}): BoardData {
  return {
    apps: [app({ id: "a" })],
    stats: null, loading: false, token: "tok",
    reload: jest.fn().mockResolvedValue(undefined),
    changeStatus: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("DockInsight / gọi ai-summary tối đa 1 lần mỗi session", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("có cache trong sessionStorage → KHÔNG gọi aiSummary khi mount", async () => {
    sessionStorage.setItem(SUMMARY_KEY, "Tóm tắt cũ từ session trước");
    render(<DockInsight board={board()} />);

    // Đợi effect hydrate chạy xong rồi khẳng định vẫn không gọi API (race C2).
    await waitFor(() => expect(sessionStorage.getItem(SUMMARY_KEY)).toBe("Tóm tắt cũ từ session trước"));
    expect(applicationsApi.aiSummary).not.toHaveBeenCalled();
  });

  it("summary_md rỗng không kích hoạt gọi lại lần hai (chặn vòng lặp C1)", async () => {
    applicationsApi.aiSummary.mockResolvedValue({ summary_md: "" });
    render(<DockInsight board={board()} />);

    await waitFor(() => expect(applicationsApi.aiSummary).toHaveBeenCalledTimes(1));
    // Chờ thêm một nhịp render nữa để nếu có bug lặp thì nó đã kịp bắn lần 2.
    await new Promise((r) => setTimeout(r, 50));
    expect(applicationsApi.aiSummary).toHaveBeenCalledTimes(1);
  });

  it("board rỗng (apps: []) không gọi aiSummary", async () => {
    render(<DockInsight board={board({ apps: [] })} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(applicationsApi.aiSummary).not.toHaveBeenCalled();
  });

  it("token null không gọi aiSummary", async () => {
    render(<DockInsight board={board({ token: null })} />);
    await new Promise((r) => setTimeout(r, 50));
    expect(applicationsApi.aiSummary).not.toHaveBeenCalled();
  });
});
