"use client";

import { ReactNode } from "react";

type Props = {
  title: string;
  source: "umami" | "postgres" | "cloudflare";
  status: "ok" | "error";
  error?: string | null;
  children: ReactNode;
};

const SOURCE_LABEL: Record<Props["source"], string> = {
  umami: "Umami",
  postgres: "Postgres",
  cloudflare: "Cloudflare",
};

/**
 * Mot khoi metric, luon ghi ro no den TU DAU va co dang tin duoc khong.
 *
 * Khi `status === "error"` thi children KHONG duoc render — day la diem chinh
 * cua component nay, khong phai chi tiet trang tri. Neu van render children,
 * cac o so se hien `0` (hoac `undefined`) vi `data` la null, va nguoi doc
 * dashboard se ket luan "thang nay khong ai truy cap" trong khi su that la
 * "nguon do dem dang chet". Mot con so sai va tu tin nguy hiem hon han mot o
 * bao loi.
 */
export default function MetricBlock({ title, source, status, error, children }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          Nguồn: {SOURCE_LABEL[source]}
        </span>
      </header>

      {status === "error" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error ?? "Không lấy được dữ liệu"}
        </div>
      ) : (
        children
      )}
    </section>
  );
}
