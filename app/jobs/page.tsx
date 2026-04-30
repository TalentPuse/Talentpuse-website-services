"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { jobsApi, PublicJobList, FilterOptions } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Navbar from "@/components/dashboard/Navbar";

const PER_PAGE = 20;

const SOURCE_LABEL: Record<string, string> = {
  vietnamworks: "VietnamWorks",
  itviec: "ITviec",
};

const SOURCE_COLOR: Record<string, string> = {
  vietnamworks: "bg-orange-50 text-orange-700 border-orange-200",
  itviec: "bg-red-50 text-red-700 border-red-200",
};

export default function JobBoardPage() {
  return (
    <ProtectedRoute>
      <JobBoardContent />
    </ProtectedRoute>
  );
}

function JobBoardContent() {
  const { token } = useAuth();
  const [data, setData] = useState<PublicJobList | null>(null);
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [salaryFilter, setSalaryFilter] = useState<string>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();

  useEffect(() => {
    if (!token) return;
    jobsApi.filters(token).then(setFilters).catch(() => {});
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await jobsApi.list(token, {
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        city: cityFilter === "all" ? null : cityFilter,
        level: levelFilter === "all" ? null : levelFilter,
        source: sourceFilter === "all" ? null : sourceFilter,
        has_salary: salaryFilter === "all" ? null : salaryFilter === "yes",
      }, controller.signal);
      if (!controller.signal.aborted) setData(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token, page, search, cityFilter, levelFilter, sourceFilter, salaryFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [load]);

  function onSearchChange(val: string) {
    setSearch(val);
    setPage(1);
  }

  function resetFilters() {
    setSearch("");
    setCityFilter("all");
    setLevelFilter("all");
    setSourceFilter("all");
    setSalaryFilter("all");
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;
  const hasFilters =
    search || cityFilter !== "all" || levelFilter !== "all" || sourceFilter !== "all" || salaryFilter !== "all";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <Navbar />

      {/* Hero search */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-3xl font-bold mb-2">
              Khám phá cơ hội việc làm
            </h1>
            <p className="text-brand-100 mb-6">
              {data
                ? `${data.total.toLocaleString()} việc làm đang tuyển dụng`
                : "Đang tải..."}
            </p>

            <div className="relative max-w-2xl">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Tìm theo tiêu đề, công ty..."
                className="w-full rounded-xl bg-white text-slate-900 pl-12 pr-4 py-3.5 text-sm outline-none shadow-lg placeholder:text-slate-400 focus:ring-2 focus:ring-white/50"
              />
            </div>
          </motion.div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          >
            <option value="all">Tất cả thành phố</option>
            {filters?.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          >
            <option value="all">Tất cả level</option>
            {filters?.levels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          >
            <option value="all">Tất cả nguồn</option>
            {filters?.sources.map((s) => (
              <option key={s} value={s}>{SOURCE_LABEL[s] || s}</option>
            ))}
          </select>

          <select
            value={salaryFilter}
            onChange={(e) => { setSalaryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          >
            <option value="all">Lương: tất cả</option>
            <option value="yes">Có hiển thị lương</option>
            <option value="no">Thỏa thuận</option>
          </select>

          {hasFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium transition"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>

        {/* Job cards */}
        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl skeleton" />
            ))}
          </div>
        ) : data && data.jobs.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {data.jobs.map((job, idx) => (
                  <motion.div
                    key={`${job.source}-${job.source_job_id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                  >
                    <JobCard job={job} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <span className="text-sm text-slate-500">
                  Trang {page} / {totalPages} ({data.total} kết quả)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    Trước
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium disabled:opacity-40 hover:bg-slate-50 transition"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-1">
              Không tìm thấy việc làm
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Thử thay đổi từ khoá hoặc bộ lọc
            </p>
            <button
              onClick={resetFilters}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium"
            >
              Xoá tất cả bộ lọc
            </button>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function JobCard({ job }: { job: PublicJobList["jobs"][number] }) {
  const sourceLabel = SOURCE_LABEL[job.source] || job.source;
  const sourceColor = SOURCE_COLOR[job.source] || "bg-slate-50 text-slate-700 border-slate-200";
  const postedDate = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "short",
      })
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-brand-200 transition-all duration-200 group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900 text-[15px] leading-snug line-clamp-2 group-hover:text-brand-700 transition-colors">
            {job.title || "Chưa có tiêu đề"}
          </h3>
          <p className="text-sm text-slate-600 mt-1 truncate">
            {job.company_name || "Chưa rõ công ty"}
          </p>
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sourceColor}`}>
          {sourceLabel}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-slate-500 mb-3">
        {job.city_canonical && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {job.city_canonical}
          </span>
        )}
        {job.job_level && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {job.job_level}
          </span>
        )}
        {job.salary_million ? (
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ~{job.salary_million.toFixed(0)} triệu
          </span>
        ) : (
          <span className="text-slate-400">Thỏa thuận</span>
        )}
        {postedDate && (
          <span className="text-xs text-slate-400">{postedDate}</span>
        )}
      </div>

      {/* Skills */}
      {job.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.skills.slice(0, 5).map((sk) => (
            <span
              key={sk}
              className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              {sk}
            </span>
          ))}
          {job.skills.length > 5 && (
            <span
              className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500"
              title={job.skills.join(", ")}
            >
              +{job.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      {job.source_url ? (
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 transition"
        >
          Xem chi tiết
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      ) : (
        <span className="text-xs text-slate-400">Chưa có link</span>
      )}
    </div>
  );
}
