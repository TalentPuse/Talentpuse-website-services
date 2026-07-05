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

type SkillRow = { skill: string; n_jobs: number; pct_of_jobs: number };
type Overview = { total_jobs: number; pct_with_salary: number; avg_salary_million: number | null };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001";

export default function LiveDataPreview() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sk, ov] = await Promise.all([
          fetch(`${API_BASE}/api/skills/top?limit=8`, { cache: "no-store" }).then(
            (r) => (r.ok ? (r.json() as Promise<SkillRow[]>) : [])
          ),
          fetch(`${API_BASE}/api/overview`, { cache: "no-store" }).then((r) =>
            r.ok ? (r.json() as Promise<Overview>) : null
          ),
        ]);
        setSkills(sk);
        setOverview(ov);
      } catch {
        /* backend down — show placeholder */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-200 rounded-sm w-1/3" />
          <div className="h-64 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-lg text-center">
        <div className="text-slate-400 text-sm">
          Đang kết nối đến hệ thống dữ liệu...
        </div>
        <div className="mt-4 h-48 bg-slate-50 rounded-lg flex items-center justify-center">
          <div className="text-slate-300">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            <span className="text-xs">Chart sẽ hiện khi có dữ liệu</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">
            Top Skills đang được săn đón
          </h3>
          {overview && overview.total_jobs > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">
              Phân tích từ {overview.total_jobs.toLocaleString()} tin tuyển dụng
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-700">Live Data</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={skills}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" stroke="#94a3b8" fontSize={12} />
          <YAxis
            dataKey="skill"
            type="category"
            stroke="#94a3b8"
            fontSize={12}
            width={55}
          />
          <Tooltip
            contentStyle={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            formatter={(value: number, _name: string, props: { payload?: { pct_of_jobs?: number } }) => {
              const pct = props?.payload?.pct_of_jobs;
              return [`${value.toLocaleString()} jobs (${pct}%)`, "Nhu cầu"];
            }}
          />
          <Bar
            dataKey="n_jobs"
            fill="url(#barGradient)"
            radius={[0, 6, 6, 0]}
          />
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#36a9fa" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
