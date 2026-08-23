import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockSkillsTop = jest.fn().mockResolvedValue([{ skill: "python", n_jobs: 10 }]);
const mockToolsTop = jest.fn().mockResolvedValue([{ tool: "docker", n_jobs: 5 }]);
const mockLanguagesTop = jest.fn().mockResolvedValue([{ lang: "English", level: "B2", n_jobs: 3 }]);
const mockBenefitsTop = jest.fn().mockResolvedValue([{ benefit: "remote", n_jobs: 7 }]);
const mockExperience = jest.fn().mockResolvedValue([{ bucket: "2-3 nam", n_jobs: 4 }]);
const mockHealth = jest.fn().mockResolvedValue({
  total_jd: 100,
  extracted: 90,
  missing: 10,
  missing_pct: 10,
  max_posted_at: null,
  max_extracted_at: null,
  gap_days: 1,
  llm: { jd: "ok", openai: "ok" },
});
const mockExportXlsx = jest.fn().mockResolvedValue(new Blob(["dummy"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
const mockReport = jest.fn().mockResolvedValue({
  generated_at: new Date().toISOString(),
  category: "AI",
  narrative: "Top 3 skills for AI: python",
  tables: { skills: [], tools: [], languages: [], benefits: [], experience: [] },
  data_note: "Based on 90 jobs",
  missing: 10,
  missing_pct: 10,
  gap_days: 1,
});

jest.mock("@/lib/api", () => ({
  proApi: {
    skillsTop: (...a: unknown[]) => mockSkillsTop(...a),
    toolsTop: (...a: unknown[]) => mockToolsTop(...a),
    languagesTop: (...a: unknown[]) => mockLanguagesTop(...a),
    benefitsTop: (...a: unknown[]) => mockBenefitsTop(...a),
    experience: (...a: unknown[]) => mockExperience(...a),
    health: (...a: unknown[]) => mockHealth(...a),
    exportXlsx: (...a: unknown[]) => mockExportXlsx(...a),
    report: (...a: unknown[]) => mockReport(...a),
  },
  dashboardApi: {
    categories: jest.fn().mockResolvedValue(["AI", "Data"]),
  },
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { subscription_tier: "pro", is_admin: false } as any,
    token: "test-token",
    isLoading: false,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/pro-insights",
}));

// Mock chart components to avoid recharts ResizeObserver
jest.mock("@/components/SkillsBar", () => ({
  __esModule: true,
  default: () => <div data-testid="skills-bar" />,
}));
jest.mock("@/components/ToolsBar", () => ({
  __esModule: true,
  default: () => <div data-testid="tools-bar" />,
}));
jest.mock("@/components/LanguagesDonut", () => ({
  __esModule: true,
  default: () => <div data-testid="languages-donut" />,
}));
jest.mock("@/components/BenefitsBar", () => ({
  __esModule: true,
  default: () => <div data-testid="benefits-bar" />,
}));
jest.mock("@/components/ExperienceBuckets", () => ({
  __esModule: true,
  default: () => <div data-testid="experience-buckets" />,
}));
jest.mock("@/components/landing/ScrollReveal", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Select to native selects for deterministic testing
let selectIndex = 0;
jest.mock("@/components/ui/select", () => {
  const React = require("react");
  function Select({ onValueChange, value, children }: any) {
    const idx = selectIndex++;
    // Determine options based on mount order: 0=category,1=city,2=period (week/month)
    // Use fixed sets matching ProInsightsClient constants
    let options: { value: string; label: string }[] = [];
    if (idx % 3 === 0) {
      options = [
        { value: "all", label: "Tất cả ngành nghề" },
        { value: "AI", label: "AI" },
        { value: "Data", label: "Data" },
      ];
    } else if (idx % 3 === 1) {
      const cities = ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Bình Dương", "Đồng Nai"];
      options = [{ value: "all", label: "Tất cả thành phố" }, ...cities.map((c) => ({ value: c, label: c }))];
    } else {
      options = [
        { value: "all", label: "Tất cả" },
        { value: "week", label: "Tuần này" },
        { value: "month", label: "Tháng này" },
      ];
    }
    const testId = idx % 3 === 0 ? "category-select" : idx % 3 === 1 ? "city-select" : "period-select";
    return React.createElement(
      "select",
      {
        "data-testid": testId,
        value: value,
        onChange: (e: any) => onValueChange(e.target.value),
        "aria-label": testId,
      },
      options.map((o) => React.createElement("option", { key: o.value, value: o.value }, o.label)),
    );
  }
  function SelectTrigger({ children }: any) {
    return <>{children}</>;
  }
  function SelectValue({ placeholder }: any) {
    return <>{placeholder}</>;
  }
  function SelectContent({ children }: any) {
    return <>{children}</>;
  }
  function SelectItem({ children }: any) {
    return <>{children}</>;
  }
  function SelectGroup({ children }: any) {
    return <>{children}</>;
  }
  function SelectLabel({ children }: any) {
    return <>{children}</>;
  }
  function SelectSeparator() {
    return null;
  }
  function SelectScrollUpButton() {
    return null;
  }
  function SelectScrollDownButton() {
    return null;
  }
  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectLabel,
    SelectSeparator,
    SelectScrollUpButton,
    SelectScrollDownButton,
  };
});

import ProInsightsClient from "@/app/pro-insights/ProInsightsClient";

describe("Pro Insights", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectIndex = 0;
    mockSkillsTop.mockResolvedValue([{ skill: "python", n_jobs: 10 }]);
    mockToolsTop.mockResolvedValue([{ tool: "docker", n_jobs: 5 }]);
    mockLanguagesTop.mockResolvedValue([{ lang: "English", level: "B2", n_jobs: 3 }]);
    mockBenefitsTop.mockResolvedValue([{ benefit: "remote", n_jobs: 7 }]);
    mockExperience.mockResolvedValue([{ bucket: "2-3 nam", n_jobs: 4 }]);
  });

  test("pro page fetches on category change", async () => {
    const user = userEvent.setup();
    render(<ProInsightsClient />);

    await waitFor(() => expect(mockSkillsTop).toHaveBeenCalled());
    expect(mockSkillsTop).toHaveBeenCalledWith("test-token", expect.objectContaining({ category: null }));

    mockSkillsTop.mockClear();
    mockToolsTop.mockClear();

    const categorySelect = screen.getByTestId("category-select");
    await user.selectOptions(categorySelect, "AI");

    await waitFor(() => expect(mockSkillsTop).toHaveBeenCalledWith("test-token", expect.objectContaining({ category: "AI" })));
    expect(mockToolsTop).toHaveBeenCalledWith("test-token", expect.objectContaining({ category: "AI" }));
  });

  test("renders five chart placeholders after load", async () => {
    render(<ProInsightsClient />);
    await waitFor(() => expect(mockSkillsTop).toHaveBeenCalled());
    expect(await screen.findByTestId("skills-bar")).toBeInTheDocument();
    expect(screen.getByTestId("tools-bar")).toBeInTheDocument();
    expect(screen.getByTestId("languages-donut")).toBeInTheDocument();
    expect(screen.getByTestId("benefits-bar")).toBeInTheDocument();
    expect(screen.getByTestId("experience-buckets")).toBeInTheDocument();
  });

  test("excel and report buttons exist", async () => {
    render(<ProInsightsClient />);
    await waitFor(() => expect(mockSkillsTop).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Tải Excel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generate Report/i })).toBeInTheDocument();
  });
});
