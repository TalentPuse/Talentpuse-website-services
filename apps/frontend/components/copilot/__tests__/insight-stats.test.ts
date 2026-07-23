import { findStaleApplied, sourceBreakdown, funnelDiagnosis } from "../insight-stats";
import type { Application } from "@/lib/api";

function app(over: Partial<Application>): Application {
  return {
    id: "id-1", source: "linkedin", source_job_id: null, title: "Data Analyst",
    company_name: null, city: null, source_url: null, salary_million: null,
    status: "applied", applied_at: "2026-07-01", notes: null, created_at: "2026-07-01T00:00:00",
    ...over,
  };
}
const TODAY = new Date("2026-07-23T00:00:00Z");

describe("findStaleApplied", () => {
  it("chỉ lấy status applied quá 7 ngày", () => {
    const apps = [
      app({ id: "old", applied_at: "2026-07-01" }),
      app({ id: "fresh", applied_at: "2026-07-22" }),
      app({ id: "other-col", applied_at: "2026-07-01", status: "offer" }),
    ];
    expect(findStaleApplied(apps, TODAY).map((s) => s.id)).toEqual(["old"]);
  });

  it("bỏ qua card không có applied_at", () => {
    expect(findStaleApplied([app({ applied_at: null })], TODAY)).toEqual([]);
  });

  it("sắp xếp cũ nhất trước", () => {
    const apps = [app({ id: "a", applied_at: "2026-07-10" }), app({ id: "b", applied_at: "2026-07-01" })];
    expect(findStaleApplied(apps, TODAY).map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("đúng 7 ngày thì KHÔNG tính là stale (biên dưới)", () => {
    // TODAY = 2026-07-23 → applied_at 2026-07-16 = đúng 7 ngày
    const apps = [app({ id: "boundary-7", applied_at: "2026-07-16" })];
    expect(findStaleApplied(apps, TODAY)).toEqual([]);
  });

  it("đúng 8 ngày thì tính là stale (biên trên)", () => {
    // TODAY = 2026-07-23 → applied_at 2026-07-15 = đúng 8 ngày
    const apps = [app({ id: "boundary-8", applied_at: "2026-07-15" })];
    expect(findStaleApplied(apps, TODAY).map((s) => s.id)).toEqual(["boundary-8"]);
  });
});

describe("sourceBreakdown", () => {
  it("đếm tổng và số card đã tới interviewing trở lên theo nguồn", () => {
    const apps = [
      app({ source: "linkedin", status: "applied" }),
      app({ source: "linkedin", status: "interviewing" }),
      app({ source: "vietnamworks", status: "offer" }),
    ];
    expect(sourceBreakdown(apps)).toEqual([
      { source: "linkedin", total: 2, interviewPlus: 1 },
      { source: "vietnamworks", total: 1, interviewPlus: 1 },
    ]);
  });
});

describe("funnelDiagnosis", () => {
  it("cảnh báo khi >= 8 applied mà chưa có phỏng vấn nào", () => {
    const apps = Array.from({ length: 8 }, (_, i) => app({ id: `a${i}`, status: "applied" }));
    expect(funnelDiagnosis(apps)).toContain("CV");
  });

  it("im lặng khi đã có phỏng vấn", () => {
    const apps = [...Array.from({ length: 8 }, (_, i) => app({ id: `a${i}` })), app({ id: "x", status: "interviewing" })];
    expect(funnelDiagnosis(apps)).toBeNull();
  });

  it("im lặng khi còn ít job", () => {
    expect(funnelDiagnosis([app({}), app({ id: "b" })])).toBeNull();
  });

  it("đúng 7 applied thì im lặng (biên dưới)", () => {
    const apps = Array.from({ length: 7 }, (_, i) => app({ id: `a${i}`, status: "applied" }));
    expect(funnelDiagnosis(apps)).toBeNull();
  });

  it("đúng 8 applied thì cảnh báo (biên trên)", () => {
    const apps = Array.from({ length: 8 }, (_, i) => app({ id: `a${i}`, status: "applied" }));
    expect(funnelDiagnosis(apps)).toContain("CV");
  });
});
