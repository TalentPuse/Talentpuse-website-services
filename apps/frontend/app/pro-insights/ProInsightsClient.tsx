"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { dashboardApi, proApi } from "@/lib/api";
import type {
  ProBenefitRow,
  ProExperienceRow,
  ProHealth,
  ProJobRaw,
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
const TOP_LIMIT = 10;

type Period = "all" | "week" | "month";

function formatLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function getVNNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
}

export function getPeriodDates(period: Period): { dateFrom: string; dateTo: string } {
  if (period === "all") return { dateFrom: "", dateTo: "" };
  const now = getVNNow();
  if (period === "week") {
    const day = now.getDay(); // 0 Sun .. 6 Sat
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { dateFrom: formatLocal(monday), dateTo: formatLocal(sunday) };
  }
  if (period === "month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dateFrom: formatLocal(first), dateTo: formatLocal(last) };
  }
  return { dateFrom: "", dateTo: "" };
}

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
  const [jobTitle, setJobTitle] = useState("");
  const [period, setPeriod] = useState<Period>("all");

  const [categories, setCategories] = useState<string[]>([]);
  const [skills, setSkills] = useState<ProSkillRow[]>([]);
  const [tools, setTools] = useState<ProToolRow[]>([]);
  const [languages, setLanguages] = useState<ProLanguageRow[]>([]);
  const [benefits, setBenefits] = useState<ProBenefitRow[]>([]);
  const [experience, setExperience] = useState<ProExperienceRow[]>([]);
  const [health, setHealth] = useState<ProHealth | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [report, setReport] = useState<ProReport | null>(null);

  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [rawExcelLoading, setRawExcelLoading] = useState(false);

  const [rawSource, setRawSource] = useState("");
  const [rawId, setRawId] = useState("");
  const [rawData, setRawData] = useState<ProJobRaw | null>(null);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const [dynamicCities, setDynamicCities] = useState<string[]>(CITIES);

  useEffect(() => {
    dashboardApi
      .categories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchCities = async () => {
      // Prefer proApi.cities (distinct city_canonical from jd_insight) if authenticated
      try {
        if (token) {
          try {
            const proCities = await proApi.cities(token);
            if (!cancelled && Array.isArray(proCities) && proCities.length > 0) {
              const names = (proCities as unknown[]).map((c: unknown) =>
                typeof c === "string" ? (c as string) : ((c as { city?: string; name?: string })?.city || (c as { name?: string })?.name || "")
              ).filter(Boolean) as string[];
              if (names.length > 0) {
                setDynamicCities(names);
                return;
              }
            }
          } catch {}
        }
      } catch {}
      try {
        const dCities = await dashboardApi.dashboardCities(50);
        if (!cancelled && Array.isArray(dCities) && dCities.length > 0) {
          const names = dCities.map((r) => r.name).filter(Boolean);
          if (names.length > 0) setDynamicCities(names);
        }
      } catch {}
    };
    fetchCities();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const fetchAll = useCallback(
    async (cat: string, cty: string, per: Period) => {
      if (!token) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setHealthError(null);
      try {
        const { dateFrom, dateTo } = getPeriodDates(per);
        const dateParams = {
          date_from: dateFrom || null,
          date_to: dateTo || null,
        };
        const [s, t, l, b, e] = await Promise.all([
          proApi.skillsTop(
            token,
            {
              category: cat || null,
              city: cty || null,
              limit: TOP_LIMIT,
              ...dateParams,
            },
            ac.signal,
          ),
          proApi.toolsTop(
            token,
            {
              category: cat || null,
              city: cty || null,
              limit: TOP_LIMIT,
              ...dateParams,
            },
            ac.signal,
          ),
          proApi.languagesTop(
            token,
            {
              category: cat || null,
              city: cty || null,
              limit: TOP_LIMIT,
              ...dateParams,
            },
            ac.signal,
          ),
          proApi.benefitsTop(
            token,
            {
              category: cat || null,
              city: cty || null,
              limit: TOP_LIMIT,
              ...dateParams,
            },
            ac.signal,
          ),
          proApi.experience(token, { category: cat || null, city: cty || null, ...dateParams }, ac.signal),
        ]);
        if (ac.signal.aborted) return;
        setSkills(s);
        setTools(t);
        setLanguages(l);
        setBenefits(b);
        setExperience(e);
        proApi
          .health(token, dateParams, ac.signal)
          .then((h) => {
            if (!ac.signal.aborted) {
              setHealth(h);
              setHealthError(null);
            }
          })
          .catch((err: unknown) => {
            if ((err as { name?: string })?.name === "AbortError") return;
            if (!ac.signal.aborted) {
              setHealthError((err as { message?: string })?.message || "Không tải được health");
            }
          });
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    fetchAll(category, city, period);
  }, [category, city, period, fetchAll]);

  const handleExport = useCallback(async () => {
    if (!token) return;
    setExcelLoading(true);
    try {
      const { dateFrom, dateTo } = getPeriodDates(period);
      const blob = await proApi.exportXlsx(token, {
        category: category || null,
        city: city || null,
        kind: "all",
        limit: TOP_LIMIT,
        date_from: dateFrom || null,
        date_to: dateTo || null,
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
  }, [token, category, city, period]);

  const handleExportRaw = useCallback(async () => {
    if (!token) return;
    setRawExcelLoading(true);
    try {
      const { dateFrom, dateTo } = getPeriodDates(period);
      const blob = await proApi.exportXlsx(token, {
        category: category || null,
        city: city || null,
        title: jobTitle || null,
        kind: "raw",
        limit: TOP_LIMIT,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      const catPart = category || "All";
      a.href = url;
      a.download = `TalentPulse_RawJD_${catPart}_${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore for now; toast could be added
    } finally {
      setRawExcelLoading(false);
    }
  }, [token, category, city, jobTitle, period]);

  const handleReport = useCallback(async () => {
    if (!token) return;
    setReportLoading(true);
    try {
      const { dateFrom, dateTo } = getPeriodDates(period);
      const r = await proApi.report(token, {
        category: category || null,
        date_from: dateFrom || null,
        date_to: dateTo || null,
      });
      setReport(r);
    } catch {
      // ignore
    } finally {
      setReportLoading(false);
    }
  }, [token, category, period]);

  const handleRawFetch = useCallback(async () => {
    if (!token || !rawSource.trim() || !rawId.trim()) return;
    setRawLoading(true);
    setRawError(null);
    setRawData(null);
    try {
      const data = await proApi.jobRaw(token, rawSource.trim(), rawId.trim());
      setRawData(data);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || "Không tải được JD gốc";
      setRawError(msg);
    } finally {
      setRawLoading(false);
    }
  }, [token, rawSource, rawId]);

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
                  {dynamicCities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">Tên công việc</label>
              <Input
                placeholder="vd: Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                aria-label="Job title filter"
                className="w-auto min-w-44"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-text-muted">Kỳ</label>
              <Select
                value={period}
                onValueChange={(v) => setPeriod(v as Period)}
              >
                <SelectTrigger aria-label="Period filter" className="w-auto min-w-36">
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="week">Tuần này</SelectItem>
                  <SelectItem value="month">Tháng này</SelectItem>
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
              <Button
                variant="outline"
                onClick={handleExportRaw}
                disabled={rawExcelLoading || loading}
              >
                {rawExcelLoading ? "Đang tải..." : "Tải JD Excel"}
              </Button>
              <Button onClick={handleReport} disabled={reportLoading || loading}>
                {reportLoading ? "Đang tạo..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </header>
      </ScrollReveal>

      {healthError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Không tải được health: {healthError}
        </div>
      )}

      {loading ? (
        <ProInsightsSkeleton />
      ) : (
        <>
          {health && (
            <ScrollReveal delay={0.05}>
              <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-1">
                <KpiCard
                  label="Đã trích xuất"
                  value={health.extracted.toLocaleString()}
                  hint={`Trên ${health.total_jd.toLocaleString()} tin JD`}
                  accent="blue"
                  series={skills.map((s) => s.n_jobs)}
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

          <ScrollReveal delay={0.24}>
            <section className="mb-8">
              <Card title="JD gốc" subtitle="Xem mô tả công việc gốc đã lọc PII (Pro only)">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">Source</label>
                    <Input
                      placeholder="vd: vietnamworks"
                      value={rawSource}
                      onChange={(e) => setRawSource(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <label className="text-xs font-medium text-text-muted">Source Job ID</label>
                    <Input
                      placeholder="vd: 123456"
                      value={rawId}
                      onChange={(e) => setRawId(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleRawFetch} disabled={rawLoading || !rawSource.trim() || !rawId.trim()}>
                    {rawLoading ? "Đang tải..." : "Xem JD gốc"}
                  </Button>
                </div>
                {rawError && <p className="mt-3 text-sm text-destructive">{rawError}</p>}
                {rawData && (
                  <div className="mt-4 space-y-3 rounded-lg border bg-muted/20 p-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-text">{rawData.title || "—"}</h4>
                      <p className="text-xs text-text-muted">
                        {rawData.company_name || "—"} · {rawData.source} / {rawData.source_job_id}
                      </p>
                      {rawData.source_url && (
                        <a href={rawData.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                          {rawData.source_url}
                        </a>
                      )}
                    </div>
                    <div>
                      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Mô tả</h5>
                      <p className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-sm leading-relaxed text-text">
                        {rawData.job_description_text || "—"}
                      </p>
                    </div>
                    <div>
                      <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Yêu cầu</h5>
                      <p className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-sm leading-relaxed text-text">
                        {rawData.job_requirement_text || "—"}
                      </p>
                    </div>
                  </div>
                )}
              </Card>
            </section>
          </ScrollReveal>
        </>
      )}
    </div>
  );
}
