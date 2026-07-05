"use client";

import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import KpiCard from "@/components/KpiCard";
import SkillsBar from "@/components/SkillsBar";
import HighestPayingSkills from "@/components/HighestPayingSkills";
import SalaryByLevel from "@/components/SalaryByLevel";
import CompaniesTable from "@/components/CompaniesTable";
import Card from "@/components/Card";
import ScrollReveal from "@/components/landing/ScrollReveal";
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

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-brand-50/30">
        <main className="max-w-7xl mx-auto px-6 py-8">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
              <p className="mt-1 text-sm text-slate-500">
                Thị trường tuyển dụng DE/AI Việt Nam — cập nhật hàng ngày
              </p>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:opacity-50"
            >
              <option value="">Tất cả ngành nghề</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </header>

          <div className={loading ? "opacity-50 transition-opacity" : "transition-opacity"}>
            <ScrollReveal>
              <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <KpiCard
                  label="Việc làm đang tuyển"
                  value={overview.total_jobs.toLocaleString()}
                  hint="Tổng hợp từ 10+ nguồn"
                  accent="blue"
                />
                <KpiCard
                  label="Công khai lương"
                  value={`${overview.pct_with_salary}%`}
                  hint="Tỷ lệ minh bạch lương"
                  accent="amber"
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
                />
              </section>
            </ScrollReveal>

            <ScrollReveal>
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

            <ScrollReveal>
              <section className="mb-8">
                <Card
                  title="Mức lương theo Level x Thành phố"
                  subtitle="P25 → Median → P75 lương tháng"
                >
                  <SalaryByLevel data={salary} />
                </Card>
              </section>
            </ScrollReveal>

            <ScrollReveal>
              <section className="mb-8">
                <Card
                  title="Top 20 công ty tuyển dụng"
                  subtitle="Xếp hạng theo số tin tuyển dụng"
                >
                  <CompaniesTable data={companies} />
                </Card>
              </section>
            </ScrollReveal>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}
