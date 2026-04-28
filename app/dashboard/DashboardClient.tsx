"use client";

import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Navbar from "@/components/dashboard/Navbar";
import KpiCard from "@/components/KpiCard";
import SkillsBar from "@/components/SkillsBar";
import HighestPayingSkills from "@/components/HighestPayingSkills";
import SalaryByLevel from "@/components/SalaryByLevel";
import CompaniesTable from "@/components/CompaniesTable";
import Card from "@/components/Card";
import ScrollReveal from "@/components/landing/ScrollReveal";
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
};

export default function DashboardClient({
  overview,
  topSkills,
  paying,
  salary,
  companies,
}: Props) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
        <Navbar />

        <main className="max-w-7xl mx-auto px-6 py-8">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Thị trường tuyển dụng DE/AI Việt Nam — cập nhật hàng ngày
            </p>
          </header>

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

          <footer className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400">
            Data cập nhật hàng ngày qua dbt build. Schema:{" "}
            <code className="bg-slate-100 px-1.5 py-0.5 rounded">
              dbt_dev_gold
            </code>
          </footer>
        </main>
      </div>
    </ProtectedRoute>
  );
}
