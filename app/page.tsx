import { api } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import SkillsBar from "@/components/SkillsBar";
import HighestPayingSkills from "@/components/HighestPayingSkills";
import SalaryByLevel from "@/components/SalaryByLevel";
import CompaniesTable from "@/components/CompaniesTable";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Fetch all 5 endpoints in parallel — SSR.
  const [overview, topSkills, paying, salary, companies] = await Promise.all([
    api.overview(),
    api.topSkills(15),
    api.highestPayingSkills(10),
    api.salaryByLevel(),
    api.topCompanies(20),
  ]);

  return (
    <main className="min-h-screen px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              🎯 TalentPulse
            </h1>
            <p className="mt-1 text-slate-600">
              DE/AI Job Market Vietnam — insights for job seekers
            </p>
          </div>
          <a
            href={`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:80001"}/docs`}
            target="_blank"
            rel="noopener"
            className="text-sm text-brand-600 hover:underline"
          >
            API docs →
          </a>
        </div>
      </header>

      {/* KPI cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <KpiCard
          label="Active jobs"
          value={overview.total_jobs}
          hint="DE/AI roles, source: VietnamWorks"
          accent="blue"
        />
        <KpiCard
          label="With visible salary"
          value={`${overview.pct_with_salary}%`}
          hint="Transparent compensation rate"
          accent="amber"
        />
        <KpiCard
          label="Avg salary"
          value={
            overview.avg_salary_million
              ? `${overview.avg_salary_million}M VND`
              : "—"
          }
          hint="Per month, monthly-equivalent"
          accent="green"
        />
      </section>

      {/* Skills row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card title="Top 15 Skills in Demand" subtitle="By number of job postings">
          <SkillsBar data={topSkills} />
        </Card>
        <Card
          title="Top 10 Highest Paying Skills"
          subtitle="Average salary among jobs requiring this skill"
        >
          <HighestPayingSkills data={paying} />
        </Card>
      </section>

      {/* Salary by level — full width */}
      <section className="mb-8">
        <Card
          title="Salary Range by Level × City"
          subtitle="P25 → Median → P75 of monthly salary"
        >
          <SalaryByLevel data={salary} />
        </Card>
      </section>

      {/* Top companies — full width table */}
      <section className="mb-8">
        <Card title="Top 20 Hiring Companies" subtitle="Ranked by active job count">
          <CompaniesTable data={companies} />
        </Card>
      </section>

      <footer className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500">
        Data refreshed daily via dbt build. Source schema:{" "}
        <code className="bg-slate-100 px-1.5 py-0.5 rounded">dbt_dev_gold</code>.
      </footer>
    </main>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
}
