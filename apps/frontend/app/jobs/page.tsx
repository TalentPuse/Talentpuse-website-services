"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { SearchX, AlertTriangle, ArrowUpDown } from "lucide-react";

import { jobsApi, applicationsApi, PublicJobList, FilterOptions, type TrackedKey } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import JobCard from "@/components/jobs/JobCard";
import JobFilterBar from "@/components/jobs/JobFilterBar";
import JobDetailSheet from "@/components/jobs/JobDetailSheet";

const PER_PAGE = 20;
const SKELETON_COUNT = 6;

export default function JobBoardPage() {
  return (
    <DashboardLayout>
      {/* Suspense bat buoc: JobBoardContent dung useSearchParams, ma Next 14
          yeu cau moi component doc search params phai nam duoi mot ranh gioi
          Suspense — thieu no thi `next build` fail o buoc prerender. */}
      <Suspense fallback={null}>
        <JobBoardContent />
      </Suspense>
    </DashboardLayout>
  );
}

/** Doc trang thai tim kiem tu URL. Nguon su that la URL chu khong phai useState,
 *  de F5 / chia se link / bam Back deu giu nguyen bo loc. */
function readParams(sp: URLSearchParams) {
  const pick = (key: string) => sp.get(key) || "all";
  const rawPage = Number(sp.get("page"));
  return {
    page: Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1,
    search: sp.get("q") || "",
    city: pick("city"),
    level: pick("level"),
    source: pick("source"),
    category: pick("category"),
    salary: pick("salary"),
    sort: sp.get("sort") === "match" ? "match" : "date",
  };
}

function JobBoardContent() {
  const { token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initial = readParams(new URLSearchParams(searchParams.toString()));
  const [data, setData] = useState<PublicJobList | null>(null);
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);
  // Trang thai loi RIENG BIET voi trang thai rong. Truoc day hai thu dung chung
  // mot nhanh render, nen backend 500 / mat mang / token het han deu hien
  // "Khong tim thay viec lam" — nguoi dung tuong kho rong trong khi that ra hong.
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(initial.page);
  const [search, setSearch] = useState(initial.search);
  const [cityFilter, setCityFilter] = useState<string>(initial.city);
  const [levelFilter, setLevelFilter] = useState<string>(initial.level);
  const [sourceFilter, setSourceFilter] = useState<string>(initial.source);
  const [salaryFilter, setSalaryFilter] = useState<string>(initial.salary);
  const [categoryFilter, setCategoryFilter] = useState<string>(initial.category);
  // "date" = moi nhat truoc (mac dinh backend), "match" = goi API voi
  // sort=match de rerank theo diem phu hop (job_fit engine).
  const [sortMode, setSortMode] = useState<"date" | "match">(
    initial.sort === "match" ? "match" : "date"
  );
  const [trackedKeys, setTrackedKeys] = useState<Map<string, TrackedKey>>(new Map());
  // Job dang mo trong panel chi tiet. Doc tu URL luc khoi tao de F5 / chia se
  // link / bam Back deu giu dung job dang xem, giong cach `search`/bo loc lam.
  const [openJob, setOpenJob] = useState<{ source: string; id: string } | null>(() => {
    const raw = searchParams.get("job");
    if (!raw) return null;
    const i = raw.indexOf(":");
    return i > 0 ? { source: raw.slice(0, i), id: raw.slice(i + 1) } : null;
  });
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
          sort: sortMode === "match" ? "match" : null,
        },
        controller.signal
      );
      if (!controller.signal.aborted) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Xoa `data` cu: neu giu lai, danh sach cua bo loc TRUOC van dung nguyen
      // trong khi chip bo loc da sang len gia tri MOI — nguoi dung doc "Ha Noi"
      // nhung dang nhin ket qua Da Nang.
      setData(null);
      setError("Không tải được việc làm");
      toast.error("Không tải được việc làm");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [token, page, search, cityFilter, levelFilter, sourceFilter, categoryFilter, salaryFilter, sortMode]);

  // Day trang thai nguoc len URL. `replace` chu khong `push` de moi lan go phim
  // khong tao mot muc lich su rieng (bam Back se phai bam hang chuc lan).
  // Chi ghi cac key KHAC mac dinh cho URL sach.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (search) sp.set("q", search);
    if (cityFilter !== "all") sp.set("city", cityFilter);
    if (levelFilter !== "all") sp.set("level", levelFilter);
    if (sourceFilter !== "all") sp.set("source", sourceFilter);
    if (categoryFilter !== "all") sp.set("category", categoryFilter);
    if (salaryFilter !== "all") sp.set("salary", salaryFilter);
    if (sortMode === "match") sp.set("sort", "match");
    if (page > 1) sp.set("page", String(page));
    if (openJob) sp.set("job", `${openJob.source}:${openJob.id}`);
    const qs = sp.toString();
    const next = qs ? `/jobs?${qs}` : "/jobs";
    if (next !== window.location.pathname + window.location.search) {
      router.replace(next, { scroll: false });
    }
  }, [router, page, search, cityFilter, levelFilter, sourceFilter, categoryFilter, salaryFilter, sortMode, openJob]);

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

  function toggleSort() {
    setSortMode((m) => (m === "match" ? "date" : "match"));
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
              {data
                ? `${data.total.toLocaleString()} việc làm đang tuyển dụng`
                : error
                  ? "Chưa tải được dữ liệu"
                  : "Đang tải..."}
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

        {/* Sap xep theo do phu hop (rerank) — day KHONG phai bo loc nen tach
            rieng khoi JobFilterBar. Chuyen sang "match" goi lai API voi
            sort=match; job_fit engine cham diem tren mot pool gioi han
            (RERANK_POOL o backend), nen phai hien ro so tin da cham o duoi. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            variant={sortMode === "match" ? "default" : "outline"}
            size="sm"
            onClick={toggleSort}
            className="gap-1.5"
          >
            <ArrowUpDown size={14} strokeWidth={1.75} />
            {sortMode === "match" ? "Phù hợp nhất" : "Mới nhất"}
          </Button>
          {sortMode === "match" && data?.scored_pool != null && (
            <p className="text-xs text-slate-500">
              Đã chấm {data.scored_pool} tin mới nhất khớp bộ lọc
            </p>
          )}
        </div>

        {/* Job cards */}
        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        ) : error ? (
          /* Nhanh LOI rieng — khong duoc gop vao nhanh rong ben duoi. Toast chi
             hien vai giay roi bien mat; neu khong co panel nay thi thu duy nhat
             con lai tren man hinh la dong "Khong tim thay viec lam", tuc la bao
             sai su that cho nguoi dung. */
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-red-300 bg-red-50/50 p-12 text-center">
            <AlertTriangle className="h-10 w-10 text-red-400" strokeWidth={1.5} />
            <p className="font-medium text-red-700">{error}</p>
            <p className="text-sm text-red-600/80">
              Có thể do mất kết nối hoặc máy chủ đang bận. Dữ liệu vẫn còn nguyên.
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Thử lại
            </Button>
          </div>
        ) : data && data.jobs.length > 0 ? (
          <>
            {/* key={data.page} chu KHONG phai key={page}: `page` doi ngay khi
                bam, con `data` chi doi sau debounce 350ms + thoi gian mang. Dung
                `page` thi React remount ca luoi va danh sach TRANG CU chay lai
                animation vao — nguoi dung thay list nhap nhay roi hien y het,
                tuong bam hut nen bam tiep, nhay qua mot trang. */}
            <motion.div
              key={data.page}
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
                      onOpenDetail={() =>
                        setOpenJob({ source: job.source, id: job.source_job_id })
                      }
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                {/* `data.page` — nhan phai khop DU LIEU DANG HIEN, khong phai
                    trang vua bam. Backend da tra san field nay (jobs.py). */}
                <span className="text-sm text-slate-500">
                  Trang {data.page} / {totalPages} ({data.total} kết quả)
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

      <JobDetailSheet
        source={openJob?.source ?? null}
        sourceJobId={openJob?.id ?? null}
        onClose={() => setOpenJob(null)}
      />
    </div>
  );
}
