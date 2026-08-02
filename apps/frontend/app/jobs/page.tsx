"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { SearchX, AlertTriangle, ArrowUpDown, Search, X } from "lucide-react";

import { jobsApi, applicationsApi, PublicJobList, FilterOptions, type TrackedKey } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import JobRow from "@/components/jobs/JobRow";
import JobFilterBar from "@/components/jobs/JobFilterBar";
import JobDetailSheet from "@/components/jobs/JobDetailSheet";

const PER_PAGE = 20;
// Bo cuc hang gon hon card nen mot man hinh chua duoc nhieu hon — khung xuong
// phai phu du chieu cao that su cua danh sach, khong thi luc du lieu ve trang
// bi giat len mot doan (CLS).
const SKELETON_COUNT = 12;

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
      {/* ── Hero TIM KIEM ──────────────────────────────────────────────────
          Truoc day day la mot dai gradient chi de chua tieu de + dem so tin —
          trang tri thuan tuy, khong lam duoc gi. O mo hinh Marketplace/Directory
          (VietnamWorks, TopCV, ITviec deu vay) THANH TIM KIEM CHINH LA CTA: viec
          dau tien nguoi dung lam khi vao trang la go tu khoa, nen no phai to va
          nam ngay tam mat, khong bi lan giua mot hang dropdown. */}
      <div className="relative overflow-hidden bg-linear-to-br from-brand-700 via-brand-600 to-brand-500 text-white">
        {/* Lop hoa tiet mo tao chieu sau — tranh mang gradient phang lì. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px, 32px 32px",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-10 sm:py-12">
          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <h1 className="text-2xl font-bold sm:text-3xl">Tìm việc phù hợp với bạn</h1>
            <p className="mt-1.5 text-sm text-brand-100">
              {data
                ? `${data.total.toLocaleString()} việc làm đang tuyển · cập nhật mỗi ngày từ VietnamWorks, ITviec, TopCV, LinkedIn`
                : error
                  ? "Chưa tải được dữ liệu"
                  : "Đang tải..."}
            </p>

            {/* O tim kiem lon. Dung chung state `search` voi JobFilterBar ben duoi
                nen go o dau cung ra cung ket qua — khong nhan doi trang thai. */}
            <div className="mt-5 flex items-center gap-2 rounded-[var(--radius-lg)] bg-white p-1.5 shadow-lg shadow-brand-900/20">
              <Search size={18} strokeWidth={2} className="ml-2.5 shrink-0 text-text-muted" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Tên công việc, công ty hoặc kỹ năng…"
                aria-label="Tìm việc làm"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-[15px] text-text outline-none placeholder:text-text-muted"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="Xoá từ khoá"
                  className="mr-1 cursor-pointer rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <X size={16} strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Tim kiem pho bien — giam ma sat cho nguoi chua biet go gi, dung
                khuyen nghi "Popular searches suggestions" cua mo hinh nay. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-brand-200">Gợi ý:</span>
              {["Data Engineer", "Backend", "AI Engineer", "Business Analyst", "Fresher"].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSearchChange(q)}
                  className="cursor-pointer rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-white/20"
                >
                  {q}
                </button>
              ))}
            </div>
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

        {/* ── Chip bo loc dang bat ────────────────────────────────────────────
            Design system canh bao dung "hidden filters", va truoc day day dung
            la van de: bo loc chi doi mau cai dropdown, cuon xuong mot doan la
            khong con thay dang loc gi — nguoi dung thac mac "sao it ket qua
            the?" ma khong biet minh dang loc Da Nang tu 10 phut truoc.
            Chip hien ro tung dieu kien va go duoc TUNG CAI, thay vi chi co nut
            "Xoa tat ca" duoc-an-ca-lang. */}
        {hasFilters && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-text-muted">Đang lọc:</span>
            {([
              ["Từ khoá", search, () => onSearchChange("")],
              ["Thành phố", cityFilter !== "all" ? cityFilter : "", () => withPageReset(setCityFilter)("all")],
              ["Cấp bậc", levelFilter !== "all" ? levelFilter : "", () => withPageReset(setLevelFilter)("all")],
              ["Nguồn", sourceFilter !== "all" ? sourceFilter : "", () => withPageReset(setSourceFilter)("all")],
              ["Ngành", categoryFilter !== "all" ? categoryFilter : "", () => withPageReset(setCategoryFilter)("all")],
              ["Lương", salaryFilter !== "all" ? salaryFilter : "", () => withPageReset(setSalaryFilter)("all")],
            ] as const)
              .filter(([, value]) => Boolean(value))
              .map(([label, value, clear]) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
                >
                  <span className="text-brand-500 dark:text-brand-400">{label}:</span>
                  <span className="max-w-[10rem] truncate">{value}</span>
                  <button
                    type="button"
                    onClick={clear}
                    aria-label={`Bỏ lọc ${label}`}
                    className="cursor-pointer rounded-full p-0.5 transition-colors hover:bg-brand-200 dark:hover:bg-brand-800"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            <button
              type="button"
              onClick={resetFilters}
              className="cursor-pointer text-xs font-medium text-text-muted underline transition-colors hover:text-text"
            >
              Xoá tất cả
            </button>
          </div>
        )}

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
          {sortMode === "match" && data != null && (
            data.scored_pool != null ? (
              <p className="text-xs text-slate-500">
                Đã chấm {data.scored_pool} tin mới nhất khớp bộ lọc
              </p>
            ) : (
              /* scored_pool = null nghia la KHONG cham duoc tin nao — gan nhu luon
                 vi ho so con rong. Im lang o day thi nguoi dung bam "Phù hợp
                 nhất", nhan lai dung thu tu cu, va khong hieu vi sao. Noi thang
                 va chi duong den cho sua. */
              <p className="text-xs text-amber-700">
                Chưa xếp được theo độ phù hợp —{" "}
                <Link href="/profile" className="font-medium underline">
                  thêm kỹ năng và vị trí mong muốn vào hồ sơ
                </Link>{" "}
                để dùng tính năng này.
              </p>
            )
          )}
        </div>

        {/* Job cards */}
        {loading && !data ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
              <Skeleton key={i} className="h-[78px] rounded-[var(--radius-lg)]" />
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
            {/* Danh sach mot cot, cac hang dinh lien nhau va cach nhau bang mot
                duong ke — day la thu bien "card roi rac" thanh "bang doc duoc":
                mat nhin chay thang mot mach xuong duoi thay vi phai nhay zic-zac
                giua hai cot.
                Hieu ung vao chi con MOT lan cho ca khoi. Truoc day moi hang tu
                chay mot animation lech nhau 0.03s — voi 20 hang la 0.6s moi
                hien xong dong cuoi, va design system xep "animation trang tri"
                vao muc phai bo. */}
            <motion.div
              key={data.page}
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-2.5"
            >
              {data.jobs.map((job) => (
                <JobRow
                  key={`${job.source}-${job.source_job_id}`}
                  job={job}
                  tracked={trackedKeys.get(`${job.source}:${job.source_job_id}`) ?? null}
                  onTracked={handleTracked}
                  onOpenDetail={() => setOpenJob({ source: job.source, id: job.source_job_id })}
                />
              ))}
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
