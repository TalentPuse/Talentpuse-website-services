"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, BadgeDollarSign, Briefcase, ExternalLink, FileText,
  GraduationCap, Layers, MapPin, ShieldCheck, TrendingUp,
} from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { jobsApi, type JobDetail } from "@/lib/api";
import JobMatchScore from "./JobMatchScore";
import JobDescriptionText from "./JobDescriptionText";

interface Props {
  source: string | null;
  sourceJobId: string | null;
  onClose: () => void;
  /** Tieu de cho job nguoi dung TU NHAP (source_job_id = NULL, khong co trong kho). */
  manualTitle?: string;
}

/** Mot o su kien trong luoi thong tin. Chi render khi CO gia tri — o trong lam
 *  luoi thung lo, trong te hon la khong co o nao. */
function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-text-muted">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
        <p className="truncate text-sm font-medium text-text">{value}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-sm font-semibold text-text">{title}</h3>
      {children}
    </section>
  );
}

function money(min: number | null, max: number | null, avg: number | null): string | null {
  if (min != null && max != null && min !== max) return `${min} – ${max} triệu`;
  const one = avg ?? min ?? max;
  return one != null ? `~${one} triệu` : null;
}

export default function JobDetailSheet({ source, sourceJobId, onClose, manualTitle }: Props) {
  const { token } = useAuth();
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // Trang thai loi RIENG voi trang thai rong. Gop hai thu lam mot se khien loi
  // mang hien thanh "tin nay khong co mo ta chi tiet" — bao sai su that.
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController>();

  const open = Boolean(source);
  const laTuNhap = open && !sourceJobId;

  useEffect(() => {
    if (!open || laTuNhap || !token || !source || !sourceJobId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null);
    jobsApi
      .detail(source, sourceJobId, token, controller.signal)
      .then((d) => { if (!controller.signal.aborted) setData(d); })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Không tải được thông tin việc làm");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [open, laTuNhap, token, source, sourceJobId, reloadKey]);

  const salary = data ? money(data.salary_min_million, data.salary_max_million, data.salary_million) : null;

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        {/* Dau panel dinh o tren: logo + tieu de + cong ty. JD dai ma cuon mai
            van biet dang xem tin nao. */}
        <SheetHeader className="shrink-0 border-b border-border bg-surface px-5 py-4">
          <div className="flex items-start gap-3">
            {data?.company_logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.company_logo_url}
                alt=""
                className="h-11 w-11 shrink-0 rounded-[var(--radius-md)] border border-border bg-surface object-contain"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-left text-base font-semibold leading-snug text-text">
                {data?.title ?? manualTitle ?? "Chi tiết việc làm"}
              </SheetTitle>
              {(data?.company_name || data?.city_canonical) && (
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
                  {data.company_name && <span className="truncate">{data.company_name}</span>}
                  {data.city_canonical && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={13} strokeWidth={1.75} />
                      {data.city_canonical}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* Job nguoi dung tu them khong nam trong kho nen khong co JD. Noi thang,
              thay vi de panel trong cho ho tuong la loi. */}
          {laTuNhap ? (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2 px-6 py-10 text-center">
              <FileText size={28} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm font-medium text-text">Việc làm bạn tự nhập</p>
              <p className="max-w-xs text-sm leading-relaxed text-text-muted">
                Tin này không đến từ kho dữ liệu nên chưa có mô tả chi tiết hay điểm phù hợp.
              </p>
            </div>
          ) : loading ? (
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="h-20 w-full rounded-[var(--radius-lg)]" />
              <Skeleton className="h-48 w-full rounded-[var(--radius-lg)]" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--danger)]/40 bg-[var(--danger)]/5 px-6 py-10 text-center">
              <AlertCircle size={28} strokeWidth={1.5} className="text-[var(--danger)]" />
              <p className="text-sm font-medium text-[var(--danger)]">{error}</p>
              <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
                Thử lại
              </Button>
            </div>
          ) : data ? (
            <div className="space-y-6">
              <JobMatchScore match={data.match} />

              {/* Luoi su kien — truoc day panel chi hien company·city·level roi
                  nhay thang vao JD, nen trong tenh trong khi API van tra ve san
                  luong, loai hinh, so nam kinh nghiem, bang cap, quy mo... */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-[var(--radius-lg)] border border-border bg-surface-2 p-4">
                <Fact icon={<BadgeDollarSign size={15} strokeWidth={1.75} />} label="Lương" value={salary ?? "Thỏa thuận"} />
                <Fact icon={<TrendingUp size={15} strokeWidth={1.75} />} label="Cấp bậc" value={data.job_level} />
                <Fact icon={<Briefcase size={15} strokeWidth={1.75} />} label="Loại hình" value={data.employment_type} />
                <Fact
                  icon={<ShieldCheck size={15} strokeWidth={1.75} />}
                  label="Kinh nghiệm"
                  value={data.years_of_experience != null ? `${data.years_of_experience} năm` : null}
                />
                <Fact icon={<GraduationCap size={15} strokeWidth={1.75} />} label="Bằng cấp" value={data.degree_label} />
                <Fact icon={<Layers size={15} strokeWidth={1.75} />} label="Quy mô" value={data.company_size_label} />
              </div>

              {data.skills.length > 0 && (
                <Section title="Kỹ năng tin này yêu cầu">
                  <div className="flex flex-wrap gap-1.5">
                    {data.skills.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              <Section title="Mô tả công việc">
                <JobDescriptionText text={data.description} />
              </Section>

              {data.requirement && (
                <Section title="Yêu cầu ứng viên">
                  <JobDescriptionText text={data.requirement} />
                </Section>
              )}

              {data.benefits.length > 0 && (
                <Section title="Quyền lợi">
                  <ul className="space-y-1.5">
                    {data.benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm leading-relaxed text-text">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {(data.num_of_views != null || data.num_of_applications != null) && (
                <p className="text-xs text-text-muted">
                  {[
                    data.num_of_views != null ? `${data.num_of_views.toLocaleString()} lượt xem` : null,
                    data.num_of_applications != null ? `${data.num_of_applications.toLocaleString()} lượt ứng tuyển` : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          ) : null}
        </div>

        {/* Chan panel dinh: CTA luon nhin thay, khong bat nguoi dung cuon het JD
            dai moi tim duoc nut ung tuyen. */}
        {data?.source_url && (
          <div className="shrink-0 border-t border-border bg-surface px-5 py-3">
            <Button asChild className="w-full gap-2">
              <a href={data.source_url} target="_blank" rel="noopener noreferrer">
                Xem tin gốc và ứng tuyển
                <ExternalLink size={15} strokeWidth={1.75} />
              </a>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
