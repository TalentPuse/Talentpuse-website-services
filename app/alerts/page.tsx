"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

import { jobsApi, MyAlertList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

const PER_PAGE = 20;

const SOURCE_LABEL: Record<string, string> = {
  vietnamworks: "VietnamWorks",
  itviec: "ITviec",
};

export default function AlertHistoryPage() {
  const { token } = useAuth();
  const [data, setData] = useState<MyAlertList | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await jobsApi.myAlerts(token, { page, per_page: PER_PAGE });
      setData(res);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    }
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <DashboardLayout>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Lịch sử Alert</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data ? `${data.total} alert đã nhận` : "Đang tải..."}
        </p>
      </header>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-600 uppercase text-xs bg-slate-50">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="px-4 py-3 font-medium">Công ty</th>
                <th className="px-4 py-3 font-medium">Thành phố</th>
                <th className="px-4 py-3 font-medium text-right">Lương</th>
                <th className="px-4 py-3 font-medium">Kênh</th>
                <th className="px-4 py-3 font-medium">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data?.alerts.map((alert, idx) => (
                <tr
                  key={`${alert.source_job_id}-${alert.sent_at}`}
                  className="border-b border-slate-100 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 text-slate-400">
                    {(page - 1) * PER_PAGE + idx + 1}
                  </td>
                  <td className="px-4 py-3">
                    {alert.source_url ? (
                      <a
                        href={alert.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 hover:text-brand-700 hover:underline line-clamp-1"
                      >
                        {alert.title || "—"}
                      </a>
                    ) : (
                      <span className="text-slate-700">{alert.title || "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {alert.company_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {alert.city_canonical || "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {alert.salary_million ? (
                      <span className="text-emerald-600 font-medium">
                        ~{alert.salary_million.toFixed(0)}M
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {alert.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(alert.sent_at).toLocaleString("vi-VN")}
                  </td>
                </tr>
              ))}
              {data && data.alerts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-400"
                  >
                    Chưa có alert nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <span className="text-xs text-slate-500">
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-md px-3 py-1.5 text-xs border border-slate-200 disabled:opacity-40 hover:bg-white transition"
              >
                Trước
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-md px-3 py-1.5 text-xs border border-slate-200 disabled:opacity-40 hover:bg-white transition"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
