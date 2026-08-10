"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import KpiCard from "@/components/KpiCard";
import SkillsBar from "@/components/SkillsBar";
import CitiesBar from "@/components/CitiesBar";
import LevelsBar from "@/components/LevelsBar";
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
  DashboardRow,
  CompanyRow,
} from "@/lib/api";

type Props = {
  overview: Overview;
  topSkills: SkillRow[];
  cities: DashboardRow[];
  levels: DashboardRow[];
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
        <SkeletonBlock className="h-[400px] rounded-[var(--radius-lg)]" />
        <SkeletonBlock className="h-[400px] rounded-[var(--radius-lg)]" />
      </section>
      <SkeletonBlock className="h-[340px] rounded-[var(--radius-lg)]" />
      <SkeletonBlock className="h-[540px] rounded-[var(--radius-lg)]" />
    </div>
  );
}

export default function DashboardClient({
  overview: initOverview,
  topSkills: initTopSkills,
  cities: initCities,
  levels: initLevels,
  companies: initCompanies,
  categories,
}: Props) {
  const [category, setCategory] = useState("");
  const [overview, setOverview] = useState(initOverview);
  const [topSkills, setTopSkills] = useState(initTopSkills);
  const [cities, setCities] = useState(initCities);
  const [levels, setLevels] = useState(initLevels);
  const [companies, setCompanies] = useState(initCompanies);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (cat: string) => {
    setLoading(true);
    try {
      const [o, ts, ct, lv, comp] = await Promise.all([
        dashboardApi.overview(cat || undefined),
        dashboardApi.topSkills(15, cat || undefined),
        dashboardApi.dashboardCities(15, cat || undefined),
        dashboardApi.dashboardLevels(15, cat || undefined),
        dashboardApi.topCompanies(20, cat || undefined),
      ]);
      setOverview(o);
      setTopSkills(ts);
      setCities(ct);
      setLevels(lv);
      setCompanies(comp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!category) {
      setOverview(initOverview);
      setTopSkills(initTopSkills);
      setCities(initCities);
      setLevels(initLevels);
      setCompanies(initCompanies);
      return;
    }
    fetchData(category);
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived sparkline series drawn from data already fetched below.
  const demandSeries = useMemo(() => topSkills.map((s) => s.n_jobs), [topSkills]);
  const citySeries = useMemo(() => cities.map((c) => c.n_jobs), [cities]);
  const companySeries = useMemo(
    () => companies.map((c) => c.n_jobs),
    [companies]
  );

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
                  label="Ngành nghề theo dõi"
                  value={categories.length.toLocaleString()}
                  hint="Tất cả ngành nghề đang tuyển"
                  accent="amber"
                />
                <KpiCard
                  label="Công ty đang tuyển"
                  value={companies.length.toLocaleString()}
                  hint="Top 20 công ty trong kỳ"
                  accent="green"
                  series={companySeries}
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
                  title="Việc làm theo Thành phố"
                  subtitle="Phân bố tin tuyển dụng theo địa điểm"
                >
                  <CitiesBar data={cities} />
                </Card>
              </section>
            </ScrollReveal>

            <ScrollReveal delay={0.15}>
              <section className="mb-8">
                <Card
                  title="Việc làm theo Cấp bậc kinh nghiệm"
                  subtitle="Junior → Senior → Lead theo số tin tuyển dụng"
                >
                  <LevelsBar data={levels} />
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