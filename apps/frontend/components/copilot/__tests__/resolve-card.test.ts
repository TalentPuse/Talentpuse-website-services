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

  it("hai card cùng tên chính xác trả ambiguous với cả hai làm candidates", () => {
    const apps = [app({ id: "a", title: "Data Analyst" }), app({ id: "b", title: "Data Analyst" })];
    const r = resolveCard(apps, "Data Analyst");
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

describe("resolveCard — bậc 4: tên công ty", () => {
  it("khớp tên công ty chính xác", () => {
    const apps = [
      app({ id: "a", title: "Data Analyst", company_name: "SUNJIN VIỆT NAM" }),
      app({ id: "b", title: "AI Engineer", company_name: "Permate" }),
    ];
    const r = resolveCard(apps, "Permate");
    expect(r).toEqual({ ok: true, card: apps[1] });
  });

  it("khớp tên công ty dạng chứa", () => {
    const apps = [
      app({ id: "a", title: "Data Analyst", company_name: "SUNJIN VIỆT NAM" }),
      app({ id: "b", title: "AI Engineer", company_name: "Permate" }),
    ];
    const r = resolveCard(apps, "sunjin");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it("hai card cùng công ty → ambiguous", () => {
    const apps = [
      app({ id: "a", title: "Business Analyst", company_name: "Permate" }),
      app({ id: "b", title: "AI Engineer", company_name: "Permate" }),
    ];
    const r = resolveCard(apps, "Permate");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toBe("ambiguous");
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("bỏ qua card có company_name null, không lỗi", () => {
    const apps = [
      app({ id: "a", title: "Data Analyst", company_name: null }),
      app({ id: "b", title: "AI Engineer", company_name: "Permate" }),
    ];
    const r = resolveCard(apps, "Permate");
    expect(r).toEqual({ ok: true, card: apps[1] });
  });
});

describe("resolveCard — bậc 5: chữ cái đầu", () => {
  it('"BA" khớp "Business Analyst"', () => {
    const apps = [
      app({ id: "a", title: "Business Analyst", company_name: "Permate" }),
      app({ id: "b", title: "AI Engineer", company_name: "Permate" }),
    ];
    const r = resolveCard(apps, "BA");
    expect(r).toEqual({ ok: true, card: apps[0] });
  });

  it('TỪ CHỐI khớp một phần: "BA" KHÔNG khớp "Business Analyst Senior"', () => {
    const apps = [app({ id: "a", title: "Business Analyst Senior", company_name: "Permate" })];
    const r = resolveCard(apps, "BA");
    expect(r).toEqual({ ok: false, reason: "not_found", candidates: [] });
  });

  it("từ chối query chỉ 1 chữ cái", () => {
    // "D" là substring hiển nhiên của "Data" nên bậc 3 (title chứa) khớp NGAY, không
    // bao giờ rơi tới bậc 5 — với query 1 ký tự, chữ cái đó luôn nằm sẵn trong title nên
    // bậc 3 luôn khớp trước. Đổi sang "X" (không xuất hiện trong "Data Analyst"/"Permate")
    // để test thật sự kiểm được nhánh not_found như tên gọi.
    const apps = [app({ id: "a", title: "Data Analyst", company_name: "Permate" })];
    const r = resolveCard(apps, "X");
    expect(r).toEqual({ ok: false, reason: "not_found", candidates: [] });
  });

  it("hai title cùng bộ chữ cái đầu → ambiguous", () => {
    // "Data Analyst" tự chứa "da" (2 ký tự đầu của "Data") nên bậc 3 khớp DUY NHẤT card
    // này trước khi kịp rơi tới bậc 5, che mất tình huống ambiguous muốn kiểm. Đổi title
    // sang cặp có cùng chữ cái đầu "da" nhưng KHÔNG chứa "da" như chuỗi con liền.
    const apps = [
      app({ id: "a", title: "Deployment Automation", company_name: "X" }),
      app({ id: "b", title: "DevOps Architect", company_name: "Y" }),
    ];
    const r = resolveCard(apps, "DA");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.candidates.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("bậc 4 THẮNG bậc 5 khi query khớp cả hai", () => {
    // "BA" là tên công ty của card b, ĐỒNG THỜI là chữ cái đầu của card a.
    const apps = [
      app({ id: "a", title: "Business Analyst", company_name: "Permate" }),
      app({ id: "b", title: "Data Engineer", company_name: "BA" }),
    ];
    const r = resolveCard(apps, "BA");
    expect(r).toEqual({ ok: true, card: apps[1] });
  });
});

describe("resolveCard — chuẩn hoá", () => {
  it("bỏ dấu tiếng Việt", () => {
    const apps = [
      app({ id: "a", title: "Chuyên viên Phân tích", company_name: "SUNJIN VIỆT NAM" }),
    ];
    expect(resolveCard(apps, "chuyen vien phan tich")).toEqual({ ok: true, card: apps[0] });
    expect(resolveCard(apps, "sunjin viet nam")).toEqual({ ok: true, card: apps[0] });
  });

  it("bỏ dấu chữ đ", () => {
    const apps = [app({ id: "a", title: "Kỹ sư Đường sắt", company_name: "X" })];
    expect(resolveCard(apps, "ky su duong sat")).toEqual({ ok: true, card: apps[0] });
  });

  it("gộp khoảng trắng liên tiếp", () => {
    const apps = [app({ id: "a", title: "Data   Analyst", company_name: "X" })];
    expect(resolveCard(apps, "data analyst")).toEqual({ ok: true, card: apps[0] });
  });
});
