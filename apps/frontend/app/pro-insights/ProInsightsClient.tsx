"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/Card";
import KpiCard from "@/components/KpiCard";
import SkillsBar from "@/components/SkillsBar";
import ToolsBar from "@/components/ToolsBar";
import LanguagesDonut from "@/components/LanguagesDonut";
import BenefitsBar from "@/components/BenefitsBar";
import ExperienceBuckets from "@/components/ExperienceBuckets";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { dashboardApi, proApi } from "@/lib/api";
import type {
  ProBenefitRow,
  ProExperienceRow,
  ProHealth,
  ProLanguageRow,
  ProReport,
  ProSkillRow,
  ProToolRow,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const ALL = "all";
const CITIES = [
  "Hà Nội",
  "Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Bình Dương",
  "Đồng Nai",
];
const LIMITS = [10, 15, 20, 50];

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

function ProInsightsSkeleton() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-[118px] rounded-[var(--radius-lg)]" />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-[420px] rounded-[var(--radius-lg)]" />
        <SkeletonBlock className="h-[420px] rounded-[var(--radius-lg)]" />
      </section>
      <SkeletonBlock className="h-[400px] rounded-[var(--radius-lg)]" />
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-[400px] rounded-[var(--radius-lg)]" />
        <SkeletonBlock className="h-[320px] rounded-[var(--radius-lg)]" />
      </section>
    </div>
  );
}

export default function ProInsightsClient() {
  const { user, token } = useAuth();
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [limit, setLimit] = useState(15);

  const [categories, setCategories] = useState<string[]>([]);
  const [skills, setSkills] = useState<ProSkillRow[]>([]);
  const [tools, setTools] = useState<ProToolRow[]>([]);
  const [languages, setLanguages] = useState<ProLanguageRow[]>([]);
  const [benefits, setBenefits] = useState<ProBenefitRow[]>([]);
  const [experience, setExperience] = useState<ProExperienceRow[]>([]);
  const [health, setHealth] = useState<ProHealth | null>(null);
  const [report, setReport] = useState<ProReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);

  useEffect(() => {
    dashboardApi
      .categories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const fetchAll = useCallback(
    async (cat: string, cty: string, lim: number) => {
      if (!token) return;
      setLoading(true);
      try {
        const [s, t, l, b, e] = await Promise.all([
          proApi.skillsTop(token, {
            category: cat || null,
            city: cty || null,
            limit: lim,
          }),
          proApi.toolsTop(token, {
            category: cat || null,
            city: cty || null,
            limit: lim,
          }),
          proApi.languagesTop(token, {
            category: cat || null,
            limit: lim,
          }),
          proApi.benefitsTop(token, {
            category: cat || null,
            city: cty || null,
            limit: lim,
          }),
          proApi.experience(token, { category: cat || null }),
        ]);
        setSkills(s);
        setTools(t);
        setLanguages(l);
        setBenefits(b);
        setExperience(e);
        proApi
          .health(token)
          .then(setHealth)
          .catch(() => {});
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchAll(category, city, limit);
  }, [category, city, limit, fetchAll]);

  const handleExport = useCallback(async () => {
    if (!token) return;
    setExcelLoading(true);
    try {
      const blob = await proApi.exportXlsx(token, {
        category: category || null,
        city: city || null,
        kind: "all",
        limit,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      const catPart = category || "All";
      a.href = url;
      a.download = `TalentPulse_Pro_${catPart}_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore for now; toast could be added
    } finally {
      setExcelLoading(false);
    }
  }, [token, category, city, limit]);

  const handleReport = useCallback(async () => {
    if (!token) return;
    setReportLoading(true);
    try {
      const r = await proApi.report(token, { category: category || null });
      setReport(r);
    } catch {
      // ignore
    } finally {
      setReportLoading(false);
    }
  }, [token, category]);

  // Keep visual filter bar in sync with auth readiness: show header always

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <ScrollReveal>
        <header className="mb-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-semibold text-text">Pro Insights</h1>
            <p className="text-sm text-text-muted">
              Phân tích thị trường lao động theo ngành &amp; thành phố — dữ liệu từ jd_insight
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">Ngành nghề</label>
              <Select
                value={category || ALL}
                onValueChange={(v) => setCategory(v === ALL ? "" : v)}
              >
                <SelectTrigger aria-label="Category filter" className="w-auto min-w-44">
                  <SelectValue placeholder="Tất cả ngành nghề" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả ngành nghề</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">Thành phố</label>
              <Select
                value={city || ALL}
                onValueChange={(v) => setCity(v === ALL ? "" : v)}
              >
                <SelectTrigger aria-label="City filter" className="w-auto min-w-40">
                  <SelectValue placeholder="Tất cả thành phố" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Tất cả thành phố</SelectItem>
                  {CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">Số lượng</label>
              <Select
                value={String(limit)}
                onValueChange={(v) => setLimit(Number(v))}
              >
                <SelectTrigger aria-label="Limit filter" className="w-auto min-w-28">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  {LIMITS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Top {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                onClick={handleExport}
                disabled={excelLoading || loading}
              >
                {excelLoading ? "Đang tải..." : "Tải Excel"}
              </Button>
              <Button onClick={handleReport} disabled={reportLoading || loading}>
                {reportLoading ? "Đang tạo..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </header>
      </ScrollReveal>

      {loading ? (
        <ProInsightsSkeleton />
      ) : (
        <>
          {health && (
            <ScrollReveal delay={0.05}>
              <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                <KpiCard
                  label="Đã trích xuất"
                  value={health.extracted.toLocaleString()}
                  hint={`Trên ${health.total_jd.toLocaleString()} tin JD`}
                  accent="blue"
                  series={skills.map((s) => s.n_jobs)}
                />
                <KpiCard
                  label="Độ trễ dữ liệu"
                  value={health.gap_days == null ? "—" : `${health.gap_days} ngày`}
                  hint={
                    health.max_extracted_at
                      ? `Mới nhất: ${new Date(health.max_extracted_at).toLocaleDateString("vi-VN")}`
                      : health.max_posted_at
                        ? `Posted: ${new Date(health.max_posted_at).toLocaleDateString("vi-VN")}`
                        : undefined
                  }
                  accent="purple"
                />
              </section>
            </ScrollReveal>
          )}

          <ScrollReveal delay={0.1}>
            <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card title="Top kỹ năng" subtitle="Theo số tin tuyển dụng">
                {skills.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Không có dữ liệu</p>
                ) : (
                  <SkillsBar data={skills.map((r) => ({ skill: r.skill, n_jobs: r.n_jobs, pct_of_jobs: 0 }))} />
                )}
              </Card>
              <Card title="Top công cụ" subtitle="Tools được nhắc tới nhiều nhất">
                {tools.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Không có dữ liệu</p>
                ) : (
                  <ToolsBar data={tools} />
                )}
              </Card>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.14}>
            <section className="mb-8">
              <Card title="Ngôn ngữ" subtitle="Phân bổ theo ngôn ngữ và cấp độ">
                {languages.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Không có dữ liệu</p>
                ) : (
                  <LanguagesDonut data={languages} />
                )}
              </Card>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.18}>
            <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card title="Phúc lợi" subtitle="Benefits phổ biến nhất">
                {benefits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Không có dữ liệu</p>
                ) : (
                  <BenefitsBar data={benefits} />
                )}
              </Card>
              <Card title="Kinh nghiệm" subtitle="Phân bổ theo số năm yêu cầu">
                {experience.length === 0 ? (
                  <p className="py-8 text-center text-sm text-text-muted">Không có dữ liệu</p>
                ) : (
                  <ExperienceBuckets data={experience} />
                )}
              </Card>
            </section>
          </ScrollReveal>

          {report && (
            <ScrollReveal delay={0.22}>
              <section className="mb-8">
                <Card
                  title="Báo cáo"
                  subtitle={`Tạo lúc ${new Date(report.generated_at).toLocaleString("vi-VN")} — ${report.category || "Tất cả ngành nghề"}`}
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                    {report.narrative}
                  </p>
                  <p className="mt-3 text-xs italic text-text-muted">{report.data_note}</p>
                  {report.tables && (
                    <div className="mt-6 grid grid-cols-1 gap-4 text-xs">
                      {report.tables.skills?.length > 0 && (
                        <div>
                          <h4 className="mb-1 font-semibold text-text">Top Skills</h4>
                          <ul className="list-disc pl-5">
                            {report.tables.skills.slice(0, 5).map((r) => (
                              <li key={r.skill}>
                                {r.skill}: {r.n_jobs}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {report.tables.tools?.length > 0 && (
                        <div>
                          <h4 className="mb-1 font-semibold text-text">Top Tools</h4>
                          <ul className="list-disc pl-5">
                            {report.tables.tools.slice(0, 5).map((r) => (
                              <li key={r.tool}>
                                {r.tool}: {r.n_jobs}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </section>
            </ScrollReveal>
          )}
        </>
      )}
    </div>
  );
}
