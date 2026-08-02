"use client";

import { useState } from "react";

import CaptureButton from "@/components/applications/CaptureButton";
import Monogram from "@/components/brand/Monogram";
import { getSourceLabel } from "@/lib/job-sources";
import { cn } from "@/lib/utils";
import type { PublicJobRow, TrackedKey } from "@/lib/api";
import { getCityLabel } from "@/lib/city-labels";

type JobRowProps = {
  job: PublicJobRow;
  tracked?: TrackedKey | null;
  onTracked?: (entry: TrackedKey) => void;
  /** Mo panel chi tiet. Khong truyen thi hang khong bam duoc. */
  onOpenDetail?: () => void;
};

function formatSalary(salaryMillion: number | null): string {
  return salaryMillion ? `${salaryMillion.toFixed(0)} triệu` : "Thỏa thuận";
}

function formatPosted(postedAt: string | null): string | null {
  if (!postedAt) return null;
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { day: "numeric", month: "numeric" });
}

/**
 * Logo cong ty, roi ve Monogram chu cai khi khong co hoac tai that bai.
 *
 * Hai duong lui, deu can that:
 *  - `logoUrl` null: backend da loc anh mac dinh cua nguon (2693 tin LinkedIn
 *    dung chung MOT icon xam — xem _LOGO_MAC_DINH ben api/jobs.py).
 *  - onError: URL con song trong kho nhung CDN da xoa anh. Khong bat loi thi
 *    trinh duyet ve o vuong vo, xau hon han chu cai co mau.
 *
 * Nen TRANG + object-contain: logo cong ty hau het la PNG nen trang, dat len
 * nen toi cua dark mode se thanh mot khoi den. Day la cach VietnamWorks,
 * ITviec, TopCV deu lam.
 */
function CompanyAvatar({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  const [hong, setHong] = useState(false);

  if (!logoUrl || hong) return <Monogram name={name} size="md" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      loading="lazy"
      width={32}
      height={32}
      onError={() => setHong(true)}
      className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] border border-border bg-white object-contain p-1"
    />
  );
}

/** Nguong mau cua diem phu hop — dung token semantic de dark mode khong vo. */
function matchTone(score: number): string {
  if (score >= 75) return "text-[var(--success)]";
  if (score >= 50) return "text-[var(--warning)]";
  return "text-text-muted";
}

/**
 * JobRow — mot tin tuyen dung tren MOT HANG (thay cho JobCard 2 cot cu).
 *
 * Bo cuc: [logo] tieu de · cong ty ———— luong | thanh pho·cap bac·ngay·nguon | % | hanh dong
 *
 * Ba quyet dinh dang chu y:
 *
 * 1. LUONG KHONG BI LAM MO. Nhom ben phai bi lam mo la thong tin phu, nhung
 *    luong khong thuoc nhom do — no la tieu chi loc so mot cua nguoi tim viec.
 * 2. CAC COT CO BE RONG CO DINH (w-24 / w-52 / w-12). Danh sach day chi doc
 *    nhanh duoc khi cac gia tri THANG HANG giua cac dong; de chung tu gian theo
 *    noi dung thi mat luon cai loi duy nhat cua kieu bo cuc nay.
 * 3. CHIP KY NANG BI BO. Khong du cho tren mot hang. Doi lay mat do: 6 -> ~14
 *    tin mot man hinh. Ky nang van con day du trong panel chi tiet.
 *
 * Duoi 768px hang tu xuong hai dong — nhoi 6 truong vao mot hang o 375px la
 * tran ngang, thu ma design system xep muc nghiem trong.
 */
export default function JobRow({ job, tracked, onTracked, onOpenDetail }: JobRowProps) {
  const title = job.title || "Chưa có tiêu đề";
  const company = job.company_name || "Chưa rõ công ty";
  const salary = formatSalary(job.salary_million);
  const posted = formatPosted(job.posted_at);

  // Thong tin phu, ghep bang dau "·" thay vi moi thu mot the co icon rieng:
  // icon o co nay chi lam nhieu mat, khong them nghia nao.
  const meta = [getCityLabel(job.city_canonical), job.job_level, posted, getSourceLabel(job.source)]
    .filter(Boolean)
    .join(" · ");

  return (
    // The le RIENG, khong con dinh lien nhau bang mot duong ke: moi tin co vien
    // + bo goc rieng, cach nhau bang khoang trong o danh sach cha. Doi lai mat
    // do (53px -> ~78px moi dong, ~14 -> ~10 tin mot man hinh), duoc lai chieu
    // sau va vung bam ro rang — dung mo hinh cua VietnamWorks/TopCV/ITviec.
    <div className="group relative flex items-center gap-3.5 rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3.5 transition-all duration-150 hover:-translate-y-px hover:border-brand-500/40 hover:shadow-md hover:shadow-brand-900/5">
      <div
        role={onOpenDetail ? "button" : undefined}
        tabIndex={onOpenDetail ? 0 : undefined}
        aria-label={onOpenDetail ? `${title} tại ${company}` : undefined}
        onClick={onOpenDetail}
        onKeyDown={(e) => {
          if (!onOpenDetail) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDetail();
          }
        }}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-sm)] outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
          onOpenDetail && "cursor-pointer"
        )}
      >
        <CompanyAvatar logoUrl={job.company_logo_url} name={job.company_name || title} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            {/* Tieu de duoc uu tien cho: `flex-1` cho no lay het phan con lai,
                con ten cong ty bi chan o 12rem. Truoc day ca hai cung co the co
                gian nen mot ten cong ty tieng Viet dai ("CONG TY TNHH THUONG
                MAI VA ...") an mat tieu de — cat dung THU QUAN TRONG NHAT de
                giu thu phu. Da thay tren trinh duyet that. */}
            <h3 className="min-w-0 flex-1 truncate text-[14px] font-semibold leading-tight text-text transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-400">
              {title}
            </h3>
            <span className="hidden shrink truncate text-[13px] text-text-muted md:block md:max-w-48">
              {company}
            </span>
          </div>

          {/* Dong hai — CHI tren mobile. Mot hang o 375px se tran ngang. */}
          <div className="mt-1 flex items-center gap-1.5 text-xs text-text-muted md:hidden">
            <span className="min-w-0 truncate">{company}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0 font-semibold text-text">{salary}</span>
            {job.city_canonical && (
              <>
                <span aria-hidden>·</span>
                <span className="shrink-0">{getCityLabel(job.city_canonical)}</span>
              </>
            )}
          </div>
        </div>

        {/* Nhom ben phai — chi hien tu 768px tro len. */}
        <div className="hidden shrink-0 items-center gap-3 md:flex">
          <span
            data-testid="job-row-salary"
            className="w-24 text-right text-[13px] font-semibold tabular-nums text-text"
          >
            {salary}
          </span>
          {/* w-64 chu khong hep hon: bon truong ghep lai ("HCMC · Director+ ·
              26/7 · VietnamWorks") vuot 208px va bi cat mat ten nguon — nguoi
              dung doc duoc "Vietnam..." thi khong biet la VietnamWorks hay
              VietnamJobs. Cat o day khong tiet kiem duoc gi vi cot van co dinh. */}
          <span className="w-64 truncate text-right text-xs text-text-muted">{meta}</span>
          <span className="w-12 text-right text-xs font-bold tabular-nums">
            {job.match_score != null && (
              <span title="Mức độ phù hợp với hồ sơ của bạn" className={matchTone(job.match_score)}>
                {job.match_score}%
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Nut hanh dong. Job DA nam trong pipeline thi luon hien — an trang thai
          "da apply" sau hover nghia la nguoi dung khong biet minh apply roi va
          apply lai lan hai. Job chua theo doi thi an tren desktop cho danh sach
          sach, nhung mobile LUON hien vi mobile khong co hover.
          Dung opacity chu khong `hidden`: cho giu nguyen nen khong nhay layout,
          va nut van nam trong thu tu Tab (focus-within keo no hien ra). */}
      <div
        data-testid="job-row-actions"
        className={cn(
          "shrink-0 transition-opacity",
          !tracked && "md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        )}
      >
        <CaptureButton
          source={job.source}
          sourceJobId={job.source_job_id}
          tracked={tracked}
          onTracked={onTracked}
        />
      </div>
    </div>
  );
}
