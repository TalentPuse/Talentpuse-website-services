"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { SearchX } from "lucide-react";

import { jobsApi, applicationsApi, PublicJobList, FilterOptions, type TrackedKey } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { ForceTheme } from "@/components/theme/ForceTheme";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import JobCard from "@/components/jobs/JobCard";
import JobFilterBar from "@/components/jobs/JobFilterBar";

const PER_PAGE = 20;
const SKELETON_COUNT = 6;

export default function JobBoardPage() {
  return (
    <DashboardLayout>
      <ForceTheme theme="light" />
      <JobBoardContent />
    </DashboardLayout>
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
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [trackedKeys, setTrackedKeys] = useState<Map<string, TrackedKey>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController>();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!token) return;
    jobsApi.filters(token).then(setFilters).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    applicationsApi
      .keys(token)
      .then((keys) =>
        setTrackedKeys(new Map(keys.map((k) => [`${k.source}:${k.source_job_id}`, k])))
      )
      .catch(() => {});
  }, [token]);

  /** Merge a just-captured/updated row in, so the card flips without a refetch. */
  const handleTracked = useCallback((entry: TrackedKey) => {
    setTrackedKeys((prev) =>
      new Map(prev).set(`${entry.source}:${entry.source_job_id}`, entry)
    );
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await jobsApi.list(
        token,
        {
          page,
          per_page: PER_PAGE,
          search: search || undefined,
          city: cityFilter === "all" ? null : cityFilter,
          level: levelFilter === "all" ? null : levelFilter,
          source: sourceFilter === "all" ? null : sourceFilter,
          category: categoryFilter === "all" ? null : categoryFilter,
          has_salary: salaryFilter === "all" ? null : salaryFilter === "yes",
        },
        controller.signal
      );
      if (!controller.signal.aborted) setData(res);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Không tải được việc làm");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token, page, search, cityFilter, levelFilter, sourceFilter, categoryFilter, salaryFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load]);

  function onSearchChange(val: string) {
    setSearch(val);
    setPage(1);
  }

  function withPageReset(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setSearch("");
    setCityFilter("all");
    setLevelFilter("all");
    setSourceFilter("all");
    setCategoryFilter("all");
    setSalaryFilter("all");
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;
  const hasFilters =
    Boolean(search) ||
    cityFilter !== "all" ||
    levelFilter !== "all" ||
    sourceFilter !== "all" ||
    categoryFilter !== "all" ||
    salaryFilter !== "all";

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-brand-50/30">
      {/* Hero */}
      <div className="bg-linear-to-r from-brand-600 to-brand-700 text-white">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="mb-2 text-3xl font-bold">Khám phá cơ hội việc làm</h1>
            <p className="text-brand-100">
              {data ? `${data.total.toLocaleString()} việc làm đang tuyển dụng` : "Đang tải..."}
            </p>
          </motion.div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-6">
        <JobFilterBar
          filters={filters}
          search={search}
          onSearchChange={onSearchChange}
          city={cityFilter}
          onCityChange={withPageReset(setCityFilter)}
          level={levelFilter}
          onLevelChange={withPageReset(setLevelFilter)}
          source={sourceFilter}
          onSourceChange={withPageReset(setSourceFilter)}
          category={categoryFilter}
          onCategoryChange={withPageReset(setCategoryFilter)}
          salary={salaryFilter}
          onSalaryChange={withPageReset(setSalaryFilter)}
          resultCount={data ? data.total : null}
          hasActiveFilters={hasFilters}
          onReset={resetFilters}
        />

        {/* Job cards */}
        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : data && data.jobs.length > 0 ? (
          <>
            <motion.div
              key={page}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="grid gap-4 md:grid-cols-2"
            >
              <AnimatePresence mode="popLayout">
                {data.jobs.map((job, idx) => (
                  <motion.div
                    key={`${job.source}-${job.source_job_id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.03 }}
                  >
                    <JobCard
                      job={job}
                      tracked={trackedKeys.get(`${job.source}:${job.source_job_id}`) ?? null}
                      onTracked={handleTracked}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  Trang {page} / {totalPages} ({data.total} kết quả)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <SearchX size={28} strokeWidth={1.5} className="text-slate-400" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-slate-700">Không tìm thấy việc làm</h3>
            <p className="mb-4 text-sm text-slate-500">Thử thay đổi từ khoá hoặc bộ lọc</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-brand-600 hover:text-brand-700"
            >
              Xoá tất cả bộ lọc
            </Button>
          </motion.div>
        )}
      </main>
    </div>
  );
}
