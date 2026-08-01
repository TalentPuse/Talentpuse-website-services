"use client";

import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function JobDetailSheet({ source, sourceJobId, onClose, manualTitle }: Props) {
  const { token } = useAuth();
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // Trang thai loi RIENG voi trang thai rong. Gop hai thu lam mot se khien loi
  // mang hien thanh "tin nay khong co mo ta chi tiet" — bao sai su that.
  const [error, setError] = useState<string | null>(null);
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
  }, [open, laTuNhap, token, source, sourceJobId]);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{data?.title ?? manualTitle ?? "Chi tiết việc làm"}</SheetTitle>
        </SheetHeader>

        {/* Job nguoi dung tu them khong nam trong kho du lieu nen khong co JD.
            Noi thang dieu do, thay vi de panel trong cho ho tuong la loi. */}
        {laTuNhap ? (
          <p className="mt-6 text-sm text-slate-600">
            Đây là việc làm bạn tự nhập nên chưa có mô tả chi tiết trong kho dữ liệu.
          </p>
        ) : loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-[var(--radius-lg)] border border-dashed border-red-300 bg-red-50/50 p-6 text-center">
            <p className="font-medium text-red-700">{error}</p>
          </div>
        ) : data ? (
          <div className="mt-6 space-y-6">
            <div className="text-sm text-slate-600">
              {[data.company_name, data.city_canonical, data.job_level]
                .filter(Boolean).join(" · ")}
            </div>

            <JobMatchScore match={data.match} />

            <section>
              <h3 className="mb-2 font-semibold text-slate-900">Mô tả công việc</h3>
              <JobDescriptionText text={data.description} />
            </section>

            {data.requirement && (
              <section>
                <h3 className="mb-2 font-semibold text-slate-900">Yêu cầu</h3>
                <JobDescriptionText text={data.requirement} />
              </section>
            )}

            {data.benefits.length > 0 && (
              <section>
                <h3 className="mb-2 font-semibold text-slate-900">Quyền lợi</h3>
                <ul className="space-y-1 text-sm text-slate-700">
                  {data.benefits.map((b) => <li key={b}>• {b}</li>)}
                </ul>
              </section>
            )}

            {data.source_url && (
              <a href={data.source_url} target="_blank" rel="noopener noreferrer"
                 className="inline-block text-sm font-medium text-brand-600 hover:underline">
                Xem tin gốc và ứng tuyển →
              </a>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
