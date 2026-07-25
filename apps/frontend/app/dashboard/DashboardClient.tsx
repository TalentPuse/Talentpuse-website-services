"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import KpiCard from "@/components/KpiCard";
import SkillsBar from "@/components/SkillsBar";
import HighestPayingSkills from "@/components/HighestPayingSkills";
import SalaryByLevel from "@/components/SalaryByLevel";
import CompaniesTable from "@/components/CompaniesTable";
import Card from "@/components/Card";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardApi } from "@/lib/api";
import type {
  Overview,
  SkillRow,
  HighestPayingSkillRow,
  SalaryByLevelRow,
  CompanyRow,
} from "@/lib/api";

type Props = {
  overview: Overview;
  topSkills: SkillRow[];
  paying: HighestPayingSkillRow[];
  salary: SalaryByLevelRow[];
  companies: CompanyRow[];
  categories: string[];
};

/** Sentinel used by the shadcn `Select` — Radix disallows an empty-string item value. */
const ALL_CATEGORIES = "all";

/** Shimmering placeholder block — see `.skeleton` in app/globals.css. */
function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden="true" />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-[132px] rounded-[var(--radius-lg)]" />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-[440px] rounded-[var(--radius-lg)]" />
        <SkeletonBlock className="h-[440px] rounded-[var(--radius-lg)]" />
      </section>
      <SkeletonBlock className="h-[480px] rounded-[var(--radius-lg)]" />
      <SkeletonBlock className="h-[540px] rounded-[var(--radius-lg)]" />
    </div>
  );
}

export default function DashboardClient({
  overview: initOverview,
  topSkills: initTopSkills,
  paying: initPaying,
  salary: initSalary,
  companies: initCompanies,
  categories,
}: Props) {
  const [category, setCategory] = useState("");
  const [overview, setOverview] = useState(initOverview);
  const [topSkills, setTopSkills] = useState(initTopSkills);
  const [paying, setPaying] = useState(initPaying);
  const [salary, setSalary] = useState(initSalary);
  const [companies, setCompanies] = useState(initCompanies);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const [o, ts, hp, sal, comp] = await Promise.all([
        dashboardApi.overview(cat || undefined),
        dashboardApi.topSkills(15, cat || undefined),
        dashboardApi.highestPayingSkills(10, cat || undefined),
        dashboardApi.salaryByLevel(cat || undefined),
        dashboardApi.topCompanies(20, cat || undefined),
      ]);
      setOverview(o);
      setTopSkills(ts);
      setPaying(hp);
      setSalary(sal);
      setCompanies(comp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!category) {
      setOverview(initOverview);
      setTopSkills(initTopSkills);
      setPaying(initPaying);
      setSalary(initSalary);
      setCompanies(initCompanies);
      return;
    }
    fetchData(category);
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived sparkline series for each KPI, drawn from data already fetched
  // for the charts below — no extra requests, just a shape for context.
  const demandSeries = useMemo(() => topSkills.map((s) => s.n_jobs), [topSkills]);
  const payingSeries = useMemo(() => paying.map((p) => p.avg_salary_million), [paying]);
  const medianSalarySeries = useMemo(() => salary.map((s) => s.p50_million), [salary]);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ScrollReveal>
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-semibold text-text">Dashboard</h1>
              <p className="mt-1 text-sm text-text-muted">
                Thị trường tuyển dụng DE/AI Việt Nam — cập nhật hàng ngày
              </p>
            </div>
            <Select
              value={category || ALL_CATEGORIES}
              onValueChange={(v) => setCategory(v === ALL_CATEGORIES ? "" : v)}
              disabled={loading}
            >
              <SelectTrigger className="w-auto min-w-48">
                <SelectValue placeholder="Tất cả ngành nghề" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>Tất cả ngành nghề</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </header>
        </ScrollReveal>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <ScrollReveal delay={0.05}>
              <section className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <KpiCard
                  label="Việc làm đang tuyển"
                  value={overview.total_jobs.toLocaleString()}
                  hint="Tổng hợp từ 10+ nguồn"
                  accent="blue"
                  series={demandSeries}
                />
                <KpiCard
                  label="Công khai lương"
                  value={`${overview.pct_with_salary}%`}
                  hint="Tỷ lệ minh bạch lương"
                  accent="amber"
                  series={payingSeries}
                />
                <KpiCard
                  label="Lương trung bình"
                  value={
                    overview.avg_salary_million
                      ? `${overview.avg_salary_million}M`
                      : "—"
                  }
                  hint="VND / tháng"
                  accent="green"
                  series={medianSalarySeries}
                />
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.1}>
              <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card
                  title="Top 15 kỹ năng được yêu cầu"
                  subtitle="Theo số lượng tin tuyển dụng"
                >
                  <SkillsBar data={topSkills} />
                </Card>
                <Card
                  title="Top 10 kỹ năng lương cao nhất"
                  subtitle="Lương trung bình theo kỹ năng"
                >
                  <HighestPayingSkills data={paying} />
                </Card>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <section className="mb-8">
                <Card
                  title="Mức lương theo Level x Thành phố"
                  subtitle="P25 → Median → P75 lương tháng"
                >
                  <SalaryByLevel data={salary} />
                </Card>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.2}>
              <section className="mb-8">
                <Card
                  title="Top 20 công ty tuyển dụng"
                  subtitle="Xếp hạng theo số tin tuyển dụng"
                >
                  <CompaniesTable data={companies} />
                </Card>
              </section>
            </ScrollReveal>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
