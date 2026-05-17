"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { adminApi, AdminJobList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

const PER_PAGE = 20;

type ColKey =
  | "source"
  | "title"
  | "company_name"
  | "company_size_bucket"
  | "job_category"
  | "city_canonical"
  | "region"
  | "job_level"
  | "degree_label"
  | "salary_million"
  | "num_of_views"
  | "num_of_applications"
  | "posted_at"
  | "expired_at"
  | "address"
  | "skills";

interface ColDef {
  key: ColKey;
  label: string;
  visible: boolean;
  width?: string;
}

const DEFAULT_COLS: ColDef[] = [
  { key: "source", label: "Nguồn", visible: false, width: "w-24" },
  { key: "title", label: "Tiêu đề", visible: true },
  { key: "company_name", label: "Công ty", visible: true, width: "w-44" },
  { key: "company_size_bucket", label: "Quy mô", visible: false, width: "w-24" },
  { key: "job_category", label: "Ngành", visible: false, width: "w-36" },
  { key: "city_canonical", label: "Thành phố", visible: true, width: "w-28" },
  { key: "region", label: "Vùng", visible: false, width: "w-24" },
  { key: "job_level", label: "Level", visible: true, width: "w-32" },
  { key: "degree_label", label: "Bằng cấp", visible: false, width: "w-28" },
  { key: "salary_million", label: "Lương (tr)", visible: true, width: "w-24" },
  { key: "num_of_views", label: "Views", visible: true, width: "w-20" },
  { key: "num_of_applications", label: "Ứng tuyển", visible: true, width: "w-24" },
  { key: "posted_at", label: "Ngày đăng", visible: true, width: "w-28" },
  { key: "expired_at", label: "Ngày hết hạn", visible: false, width: "w-28" },
  { key: "address", label: "Địa chỉ", visible: false, width: "w-48" },
  { key: "skills", label: "Skills", visible: true },
];

const SOURCE_LABEL: Record<string, string> = {
  vietnamworks: "VietnamWorks",
  itviec: "ITviec",
};

const FALLBACK_URL: Record<string, string> = {
  vietnamworks: "https://www.vietnamworks.com",
  itviec: "https://itviec.com",
};

function buildJobUrl(job: { source: string; source_url: string | null }): string {
  if (job.source_url) return job.source_url;
  return FALLBACK_URL[job.source] || "#";
}

export default function AdminJobsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminJobList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [salaryFilter, setSalaryFilter] = useState<string>("all");
  const [cols, setCols] = useState<ColDef[]>(DEFAULT_COLS);
  const [showColPicker, setShowColPicker] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [cities, setCities] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);

  const visibleCols = cols.filter((c) => c.visible);

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
    } catch (err) {
      console.error("Failed to load jobs:", err);
    }
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

  function toggleCol(key: ColKey) {
    setCols((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible: !c.visible } : c))
    );
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  function renderCell(job: AdminJobList["jobs"][0], col: ColKey) {
    switch (col) {
      case "source":
        return (
          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {SOURCE_LABEL[job.source] || job.source}
          </span>
        );
      case "title": {
        const url = buildJobUrl(job);
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline line-clamp-2"
          >
            {job.title || "—"}
          </a>
        );
      }
      case "company_name":
        return (
          <span className="text-slate-700 truncate block max-w-[200px]">
            {job.company_name || "—"}
          </span>
        );
      case "company_size_bucket":
        return job.company_size_bucket || "—";
      case "job_category":
        return (
          <span className="text-slate-600 truncate block max-w-[160px]">
            {job.job_category || "—"}
          </span>
        );
      case "city_canonical":
        return <span className="text-slate-600">{job.city_canonical || "—"}</span>;
      case "region":
        return <span className="text-slate-600">{job.region || "—"}</span>;
      case "job_level":
        return job.job_level ? (
          <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            {job.job_level}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        );
      case "degree_label":
        return <span className="text-slate-600">{job.degree_label || "—"}</span>;
      case "salary_million":
        return (
          <span className="tabular-nums text-slate-700">
            {job.salary_million ? `${job.salary_million.toFixed(1)}M` : "—"}
          </span>
        );
      case "num_of_views":
        return (
          <span className="tabular-nums text-slate-500">
            {job.num_of_views?.toLocaleString() ?? "—"}
          </span>
        );
      case "num_of_applications":
        return (
          <span className="tabular-nums text-slate-500">
            {job.num_of_applications?.toLocaleString() ?? "—"}
          </span>
        );
      case "posted_at":
        return (
          <span className="text-slate-500 text-xs whitespace-nowrap">
            {job.posted_at
              ? new Date(job.posted_at).toLocaleDateString("vi-VN")
              : "—"}
          </span>
        );
      case "expired_at":
        return (
          <span className="text-slate-500 text-xs whitespace-nowrap">
            {job.expired_at
              ? new Date(job.expired_at).toLocaleDateString("vi-VN")
              : "—"}
          </span>
        );
      case "address":
        return (
          <span className="text-slate-600 text-xs truncate block max-w-[200px]" title={job.address || undefined}>
            {job.address || "—"}
          </span>
        );
      case "skills":
        return (
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
        );
    }
  }

  return (
    <AdminLayout>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">
            Quản lý Jobs
          </h1>
          {data && (
            <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
              {data.total} jobs
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Tất cả jobs đang active trong hệ thống
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
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
        {/* Column picker toggle */}
        <div className="relative">
          <button
            onClick={() => setShowColPicker((v) => !v)}
            className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            Cột hiển thị
          </button>
          <AnimatePresence>
            {showColPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-slate-200 p-3 z-50 min-w-[200px]"
              >
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Hiển thị cột</div>
                {cols.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer text-sm text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={c.visible}
                      onChange={() => toggleCol(c.key)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                    />
                    {c.label}
                  </label>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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
                {visibleCols.map((col) => (
                  <th key={col.key} className={`px-4 py-3 font-medium ${col.key === "salary_million" || col.key === "num_of_views" || col.key === "num_of_applications" ? "text-right" : ""}`}>
                    {col.label}
                  </th>
                ))}
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
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${col.width ?? ""} ${col.key === "salary_million" || col.key === "num_of_views" || col.key === "num_of_applications" ? "text-right" : ""}`}
                    >
                      {renderCell(job, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
              {data && data.jobs.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleCols.length + 1}
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
