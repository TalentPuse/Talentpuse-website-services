"use client";

import { cn } from "@/lib/utils";
import type { JobMatch } from "@/lib/api";

const TONG_TIEU_CHI = 5;

function mau(score: number) {
  if (score >= 75) return "text-emerald-600 ring-emerald-200 bg-emerald-50";
  if (score >= 50) return "text-amber-600 ring-amber-200 bg-amber-50";
  return "text-slate-500 ring-slate-200 bg-slate-50";
}

export default function JobMatchScore({ match }: { match: JobMatch | null }) {
  // Ho so rong => KHONG hien 0%. Mot con so bia cho ho so trong day nguoi dung
  // ket luan rang diem nay vo nghia; moi ho dien ho so thi vua that vua huu ich.
  if (!match) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-slate-300 p-4 text-sm text-slate-600">
        Thêm kỹ năng và vị trí mong muốn vào hồ sơ để xem mức độ phù hợp của bạn với tin này.
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-slate-200 p-4">
      <div className="flex items-baseline gap-3">
        <span className={cn("rounded-full px-3 py-1 text-2xl font-bold ring-1", mau(match.score))}>
          {match.score}%
        </span>
        <span className="text-sm font-medium text-slate-700">Phù hợp với bạn</span>
      </div>

      {match.reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {match.reasons.map((r) => (
            <li key={r} className="text-sm text-slate-600">• {r}</li>
          ))}
        </ul>
      )}

      {/* Chi hien phan "con thieu" khi co so la 'required'. Voi 'mentioned' ta
          KHONG BIET tin yeu cau gi, nen liet ke o day se la bia dat. */}
      {match.skill_basis === "required" && match.missing_skills.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Còn thiếu</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {match.missing_skills.map((s) => (
              <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Noi ro da cham tren bao nhieu tieu chi, de nguoi dung khong tuong moi
          diem so deu cung mot do tin cay. */}
      <p className="mt-3 text-xs text-slate-400">
        Đã chấm trên {match.criteria_used.length}/{TONG_TIEU_CHI} tiêu chí
      </p>
    </div>
  );
}
