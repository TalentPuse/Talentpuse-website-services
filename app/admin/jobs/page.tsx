"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { adminApi, AdminJobList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

const PER_PAGE = 20;

export default function AdminJobsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminJobList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [salaryFilter, setSalaryFilter] = useState<string>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [cities, setCities] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminApi.jobs(token, {
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        city: cityFilter === "all" ? null : cityFilter,
        level: levelFilter === "all" ? null : levelFilter,
        has_salary:
          salaryFilter === "all" ? null : salaryFilter === "yes",
      });
      setData(res);

      if (cities.length === 0 && res.jobs.length > 0) {
        const uniqueCities = [
          ...new Set(
            res.jobs
              .map((j) => j.city_canonical)
              .filter(Boolean) as string[]
          ),
        ].sort();
        setCities(uniqueCities);
      }
      if (levels.length === 0 && res.jobs.length > 0) {
        const uniqueLevels = [
          ...new Set(
            res.jobs
              .map((j) => j.job_level)
              .filter(Boolean) as string[]
          ),
        ].sort();
        setLevels(uniqueLevels);
      }
    } catch {}
  }, [token, page, search, cityFilter, levelFilter, salaryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!token || cities.length > 0) return;
    adminApi
      .jobs(token, { page: 1, per_page: 100 })
      .then((res) => {
        const uc = [
          ...new Set(
            res.jobs.map((j) => j.city_canonical).filter(Boolean) as string[]
          ),
        ].sort();
        const ul = [
          ...new Set(
            res.jobs.map((j) => j.job_level).filter(Boolean) as string[]
          ),
        ].sort();
        setCities(uc);
        setLevels(ul);
      })
      .catch(() => {});
  }, [token]);

  function onSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {}, 300);
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <AdminLayout>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            Quản lý Jobs có thể Alert
          </h1>
          {data && (
            <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
              {data.total} jobs
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Tất cả jobs đang active trong hệ thống — có thể được gửi alert cho
          user
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo tiêu đề hoặc công ty..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
        />
        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="all">Tất cả thành phố</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="all">Tất cả level</option>
          {levels.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select
          value={salaryFilter}
          onChange={(e) => {
            setSalaryFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="all">Lương: tất cả</option>
          <option value="yes">Có lương</option>
          <option value="no">Không có lương</option>
        </select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-600 uppercase text-xs bg-slate-50">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="px-4 py-3 font-medium">Công ty</th>
                <th className="px-4 py-3 font-medium">Thành phố</th>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium text-right">
                  Lương (tr)
                </th>
                <th className="px-4 py-3 font-medium text-right">Views</th>
                <th className="px-4 py-3 font-medium text-right">
                  Ứng tuyển
                </th>
                <th className="px-4 py-3 font-medium">Ngày đăng</th>
                <th className="px-4 py-3 font-medium">Skills</th>
              </tr>
            </thead>
            <tbody>
              {data?.jobs.map((job, idx) => (
                <tr
                  key={`${job.source}-${job.source_job_id}`}
                  className="border-b border-slate-100 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 text-slate-400">
                    {(page - 1) * PER_PAGE + idx + 1}
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <a
                      href={`https://www.vietnamworks.com/--${job.source_job_id}-jd`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-600 hover:text-brand-700 hover:underline line-clamp-2"
                    >
                      {job.title || "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">
                    {job.company_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {job.city_canonical || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {job.job_level ? (
                      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        {job.job_level}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                    {job.salary_million
                      ? `${job.salary_million.toFixed(1)}M`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {job.num_of_views?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {job.num_of_applications?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {job.posted_at
                      ? new Date(job.posted_at).toLocaleDateString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {job.skills.slice(0, 3).map((sk) => (
                        <span
                          key={sk}
                          className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {sk}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span
                          className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 cursor-default"
                          title={job.skills.join(", ")}
                        >
                          +{job.skills.length - 3}
                        </span>
                      )}
                      {job.skills.length === 0 && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data && data.jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Không tìm thấy job nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md px-3 py-1.5 text-xs border border-slate-200 disabled:opacity-40 hover:bg-white transition"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md px-3 py-1.5 text-xs border border-slate-200 disabled:opacity-40 hover:bg-white transition"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AdminLayout>
  );
}
