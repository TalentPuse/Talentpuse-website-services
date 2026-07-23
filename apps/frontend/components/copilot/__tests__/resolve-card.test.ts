import { resolveCard, describeCandidates } from "../resolve-card";
import type { Application } from "@/lib/api";

function app(over: Partial<Application>): Application {
  return {
    id: "id-1", source: "linkedin", source_job_id: null, title: "Data Analyst",
    company_name: "SUNJIN", city: "HCMC", source_url: null, salary_million: null,
    status: "applied", applied_at: null, notes: null, created_at: "2026-07-01T00:00:00",
    ...over,
  };
}

describe("resolveCard", () => {
  it("khớp id chính xác", () => {
    const apps = [app({ id: "a" }), app({ id: "b", title: "AI Engineer" })];
    const r = resolveCard(apps, "b");
    expect(r).toEqual({ ok: true, card: apps[1] });
  });

  it("khớp title chính xác, bỏ qua hoa thường và khoảng trắng thừa", () => {
    const apps = [app({ id: "a", title: "AI Engineer" }), app({ id: "b", title: "Data Engineer" })];
    const r = resolveCard(apps, "  ai engineer ");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("ưu tiên khớp chính xác hơn khớp chứa", () => {
    const apps = [app({ id: "a", title: "Data Engineer" }), app({ id: "b", title: "Senior Data Engineer" })];
    const r = resolveCard(apps, "Data Engineer");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("khớp chứa khi chỉ có một ứng viên", () => {
    const apps = [app({ id: "a", title: "AI ＆DATA Scientist/Databricks" }), app({ id: "b", title: "Business Analyst" })];
    const r = resolveCard(apps, "databricks");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("trả ambiguous kèm candidates khi nhiều card cùng khớp chứa", () => {
    const apps = [app({ id: "a", title: "Data Analyst" }), app({ id: "b", title: "Data Engineer" })];
    const r = resolveCard(apps, "data");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("ambiguous");
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("trả not_found khi không khớp gì", () => {
    const r = resolveCard([app({})], "kubernetes");
    expect(r).toEqual({ ok: false, reason: "not_found", candidates: [] });
  });

  it("trả not_found với query rỗng", () => {
    const r = resolveCard([app({})], "   ");
    expect(r).toEqual({ ok: false, reason: "not_found", candidates: [] });
  });

  it("describeCandidates liệt kê tên + công ty + trạng thái", () => {
    const out = describeCandidates([app({ id: "a", title: "Data Analyst", company_name: "SUNJIN", status: "applied" })]);
    expect(out).toContain("Data Analyst");
    expect(out).toContain("SUNJIN");
    expect(out).toContain("applied");
  });
});
