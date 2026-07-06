/**
 * Shared job-source metadata (label + badge tint) for the job board and any
 * other surface that renders a job's source (VietnamWorks/ITviec/LinkedIn/...).
 *
 * Class strings are literal (not composed at runtime) so Tailwind's purge
 * step can see and keep them.
 */

export const SOURCE_LABEL: Record<string, string> = {
  vietnamworks: "VietnamWorks",
  itviec: "ITviec",
  linkedin: "LinkedIn",
};

export const SOURCE_BADGE_CLASS: Record<string, string> = {
  vietnamworks: "bg-orange-50 text-orange-700 border-orange-200",
  itviec: "bg-red-50 text-red-700 border-red-200",
  linkedin: "bg-blue-50 text-blue-700 border-blue-200",
};

/** Neutral fallback tint for sources not present in SOURCE_BADGE_CLASS. */
export const SOURCE_BADGE_CLASS_FALLBACK = "bg-slate-50 text-slate-700 border-slate-200";

export function getSourceLabel(source: string): string {
  return SOURCE_LABEL[source] || source;
}

export function getSourceBadgeClass(source: string): string {
  return SOURCE_BADGE_CLASS[source] || SOURCE_BADGE_CLASS_FALLBACK;
}
