"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity } from "lucide-react";

import AnimatedCounter from "@/components/landing/AnimatedCounter";
import ScrollReveal from "@/components/landing/ScrollReveal";
import GlowCard from "@/components/brand/GlowCard";
import { chartAxisProps, useChartTheme } from "@/lib/chart-theme";
import { translations, type Lang } from "@/lib/landing-i18n";

type Dict = (typeof translations)["vi"];
type SkillRow = { skill: string; n_jobs: number; pct_of_jobs: number };
type Overview = {
  total_jobs: number;
  pct_with_salary: number;
  avg_salary_million: number | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";

const copy = {
  vi: {
    badge: "Dữ liệu thị trường trực tiếp",
    heading: "Số liệu thật, cập nhật liên tục",
    sub: "Không phải con số minh hoạ — đây là dữ liệu tổng hợp trực tiếp từ kho phân tích tuyển dụng của TalentPulse.",
    chartTitle: "Top skills được săn đón nhất",
    live: "Trực tiếp",
    demand: "Nhu cầu",
    jobsWord: "jobs",
    basis: (n: number) => `Phân tích từ ${n.toLocaleString()} tin tuyển dụng`,
    connecting: "Đang kết nối tới kho dữ liệu…",
    avgSalary: "Lương trung bình",
    withSalary: "Tin có công khai lương",
    million: "tr",
  },
  en: {
    badge: "Live market data",
    heading: "Real numbers, always current",
    sub: "Not illustrative filler — this is data aggregated straight from TalentPulse's recruitment analytics warehouse.",
    chartTitle: "Most in-demand skills right now",
    live: "Live",
    demand: "Demand",
    jobsWord: "jobs",
    basis: (n: number) => `Analyzed from ${n.toLocaleString()} job postings`,
    connecting: "Connecting to the data warehouse…",
    avgSalary: "Average salary",
    withSalary: "Postings with public salary",
    million: "M",
  },
} as const;

type Props = { t: Dict; lang: Lang };

export default function Stats({ t, lang }: Props) {
  const c = copy[lang];
  const theme = useChartTheme();
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [sk, ov] = await Promise.all([
          fetch(`${API_BASE}/api/skills/top?limit=8`, {
            cache: "no-store",
            signal: controller.signal,
          }).then((r) => (r.ok ? (r.json() as Promise<SkillRow[]>) : [])),
          fetch(`${API_BASE}/api/overview`, {
            cache: "no-store",
            signal: controller.signal,
          }).then((r) => (r.ok ? (r.json() as Promise<Overview>) : null)),
        ]);
        setSkills(sk);
        setOverview(ov);
      } catch {
        /* backend offline — the panel falls back to marketing counters */
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, []);

  const totalJobs = overview?.total_jobs && overview.total_jobs > 0 ? overview.total_jobs : 1000;

  const kpis = [
    { value: <AnimatedCounter target={10} suffix="+" />, label: t.stats.sources },
    { value: <AnimatedCounter target={totalJobs} suffix="+" />, label: t.stats.jobs },
    { value: "24/7", label: t.stats.realtime },
    { value: <AnimatedCounter target={4} suffix="+" />, label: t.stats.channels },
  ];

  return (
    <section id="analytics" className="relative border-y border-border bg-surface-2/30">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Copy + KPI grid */}
          <div className="lg:col-span-5">
            <ScrollReveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-brand-300">
                <Activity size={14} strokeWidth={2} />
                {c.badge}
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
                {c.heading}
              </h2>
              <p className="mt-4 max-w-md text-text-muted">{c.sub}</p>
            </ScrollReveal>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {kpis.map((kpi, i) => (
                <ScrollReveal key={i} delay={i * 0.08}>
                  <div className="rounded-xl border border-border bg-surface p-5">
                    <div className="font-mono text-3xl font-bold text-text">{kpi.value}</div>
                    <div className="mt-1 text-sm text-text-muted">{kpi.label}</div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>

          {/* Live chart */}
          <div className="lg:col-span-7">
            <ScrollReveal direction="right" delay={0.1}>
              <GlowCard className="p-6 sm:p-7">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-text">
                      {c.chartTitle}
                    </h3>
                    {overview && overview.total_jobs > 0 && (
                      <p className="mt-0.5 text-sm text-text-muted">
                        {c.basis(overview.total_jobs)}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                    {c.live}
                  </span>
                </div>

                {loading ? (
                  <div className="skeleton h-[300px] w-full" />
                ) : skills.length === 0 ? (
                  <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-text-muted">
                    <Activity size={28} strokeWidth={1.5} />
                    <span className="text-sm">{c.connecting}</span>
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={skills}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="statsBar" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={theme.series[0]} />
                            <stop offset="100%" stopColor={theme.series[1]} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme.grid}
                          horizontal={false}
                        />
                        <XAxis type="number" {...chartAxisProps(theme.axis)} />
                        <YAxis
                          dataKey="skill"
                          type="category"
                          width={72}
                          {...chartAxisProps(theme.axis)}
                        />
                        <Tooltip
                          cursor={{ fill: theme.grid, opacity: 0.25 }}
                          contentStyle={theme.tooltip}
                          formatter={(
                            value: number,
                            _name: string,
                            props: { payload?: { pct_of_jobs?: number } }
                          ) => {
                            const pct = props?.payload?.pct_of_jobs;
                            return [
                              `${value.toLocaleString()} ${c.jobsWord} (${pct}%)`,
                              c.demand,
                            ];
                          }}
                        />
                        <Bar dataKey="n_jobs" fill="url(#statsBar)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>

                    {overview && (
                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
                        {overview.avg_salary_million != null && (
                          <div>
                            <div className="font-mono text-2xl font-bold text-text">
                              {overview.avg_salary_million.toLocaleString()}
                              <span className="ml-1 text-sm font-normal text-text-muted">
                                {c.million}
                              </span>
                            </div>
                            <div className="mt-0.5 text-sm text-text-muted">{c.avgSalary}</div>
                          </div>
                        )}
                        <div>
                          <div className="font-mono text-2xl font-bold text-text">
                            {overview.pct_with_salary}%
                          </div>
                          <div className="mt-0.5 text-sm text-text-muted">{c.withSalary}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </GlowCard>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
