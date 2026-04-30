"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

import { jobsApi, MyAlertList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Navbar from "@/components/dashboard/Navbar";

const PER_PAGE = 20;

const SOURCE_LABEL: Record<string, string> = {
  vietnamworks: "VietnamWorks",
  itviec: "ITviec",
};

export default function AlertHistoryPage() {
  return (
    <ProtectedRoute>
      <AlertHistoryContent />
    </ProtectedRoute>
  );
}

function AlertHistoryContent() {
  const { token } = useAuth();
  const [data, setData] = useState<MyAlertList | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await jobsApi.myAlerts(token, { page, per_page: PER_PAGE });
      setData(res);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <h1 className="text-2xl font-bold text-slate-900">
              Việc làm đã gợi ý cho bạn
            </h1>
            {data && data.total > 0 && (
              <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">
                {data.total} alert
              </span>
            )}
          </div>

          {loading && !data ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl skeleton" />
              ))}
            </div>
          ) : data && data.alerts.length > 0 ? (
            <>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b border-slate-200 text-slate-500 uppercase text-xs bg-slate-50">
                        <th className="px-4 py-3 font-medium">Việc làm</th>
                        <th className="px-4 py-3 font-medium">Công ty</th>
                        <th className="px-4 py-3 font-medium">Thành phố</th>
                        <th className="px-4 py-3 font-medium text-right">Lương</th>
                        <th className="px-4 py-3 font-medium">Ngày gửi</th>
                        <th className="px-4 py-3 font-medium text-center">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.alerts.map((alert, idx) => {
                        const sourceLabel = alert.source
                          ? SOURCE_LABEL[alert.source] || alert.source
                          : "";
                        return (
                          <tr
                            key={`${alert.source_job_id}-${idx}`}
                            className="border-b border-slate-100 hover:bg-slate-50/50"
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900 line-clamp-1">
                                {alert.title || "Không rõ"}
                              </div>
                              {sourceLabel && (
                                <span className="text-xs text-slate-400">{sourceLabel}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">
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
                            <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.66-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 3.99-1.73 6.65-2.87 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                                </svg>
                                {new Date(alert.sent_at).toLocaleDateString("vi-VN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {alert.source_url ? (
                                <a
                                  href={alert.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-brand-600 hover:bg-brand-50 transition"
                                  title="Xem việc làm"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
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
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.66-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.24.37-.49 1.02-.75 3.99-1.73 6.65-2.87 7.97-3.44 3.8-1.58 4.59-1.86 5.1-1.87.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">
                Chưa có alert nào
              </h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
                Liên kết Telegram để nhận gợi ý việc làm phù hợp với hồ sơ của bạn mỗi ngày.
              </p>
              <a
                href="/profile"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Cập nhật hồ sơ
              </a>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
