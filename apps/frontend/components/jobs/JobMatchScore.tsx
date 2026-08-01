"use client";

import { Check, Target, Zap } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { JobMatch } from "@/lib/api";

const TONG_TIEU_CHI = 5;

/** Mau theo nguong. Dung token semantic cua app (--success/--warning/--text-muted)
 *  thay vi hardcode slate/emerald — bang mau cung se VO o dark mode, vi
 *  text-slate-700 tren nen toi la khong doc duoc. */
function tone(score: number) {
  if (score >= 75) return { ring: "var(--success)", text: "text-[var(--success)]", label: "Rất hợp với bạn" };
  if (score >= 50) return { ring: "var(--warning)", text: "text-[var(--warning)]", label: "Khá hợp với bạn" };
  return { ring: "var(--text-muted)", text: "text-text-muted", label: "Ít liên quan" };
}

export default function JobMatchScore({ match }: { match: JobMatch | null }) {
  // Ho so rong => KHONG hien 0%. Mot con so bia cho ho so trong day nguoi dung
  // ket luan rang diem nay vo nghia; moi ho dien ho so thi vua that vua huu ich.
  if (!match) {
    return (
      <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2 p-4">
        <Target size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-muted" />
        <p className="text-sm leading-relaxed text-text-muted">
          Thêm kỹ năng và vị trí mong muốn vào hồ sơ để xem mức độ phù hợp của bạn với tin này.
        </p>
      </div>
    );
  }

  const t = tone(match.score);

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {/* Dai gradient AI cua app (--ai-from/--ai-to) de tach khoi diem nay khoi
          phan con lai — day la thu duy nhat tren panel ma nguoi dung KHONG tim
          duoc o tin goc, nen no xung dang duoc nhan manh. */}
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg, var(--ai-from), var(--ai-to))" }}
      />

      <div className="flex items-center gap-4 p-4">
        {/* Vong tron tien do bang conic-gradient — khong can thu vien bieu do. */}
        <div
          className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{
            background: `conic-gradient(${t.ring} ${match.score * 3.6}deg, var(--surface-2) 0deg)`,
          }}
          role="img"
          aria-label={`Độ phù hợp ${match.score} phần trăm`}
        >
          <div className="grid h-[52px] w-[52px] place-items-center rounded-full bg-surface">
            {/* Giu dau "%" LIEN MACH trong mot node text. Tach thanh hai the se
                lam `getByText("78%")` truot, va quan trong hon: nguoi dung da
                chon hien dang phan tram — "78" tran thi 78 cai gi? */}
            <span className={cn("text-[15px] font-bold tabular-nums leading-none", t.text)}>
              {match.score}%
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">{t.label}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            Chấm trên {match.criteria_used.length}/{TONG_TIEU_CHI} tiêu chí có dữ liệu
          </p>
        </div>
      </div>

      {match.reasons.length > 0 && (
        <ul className="space-y-1.5 border-t border-border px-4 py-3">
          {match.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm text-text">
              <Check size={15} strokeWidth={2.25} className="mt-0.5 shrink-0 text-[var(--success)]" />
              <span className="leading-snug">{r}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Chi hien "con thieu" khi co so la 'required'. Voi 'mentioned' ta KHONG
          BIET tin yeu cau gi, nen liet ke o day la bia dat va se thanh loi
          khuyen sai. */}
      {match.skill_basis === "required" && match.missing_skills.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Zap size={13} strokeWidth={2} />
            Kỹ năng bạn chưa có
          </p>
          <div className="flex flex-wrap gap-1.5">
            {match.missing_skills.map((s) => (
              <span
                key={s}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-muted"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
