"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { adminApi, AlertLogList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

const PER_PAGE = 50;

export default function AdminAlertsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AlertLogList | null>(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dispatching, setDispatching] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminApi.alertLogs(token, {
        page,
        per_page: PER_PAGE,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setData(res);
    } catch (err) {
      console.error("Failed to load alert logs:", err);
    }
  }, [token, page, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDispatch() {
    if (!token) return;
    setDispatching(true);
    try {
      const res = await adminApi.dispatchAlerts(token);
      toast.success(`Đã gửi ${res.dispatched} alert`);
      load();
    } catch {
      toast.error("Dispatch thất bại");
    } finally {
      setDispatching(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alert Logs</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${data.total} alert đã gửi` : "Đang tải..."}
          </p>
        </div>
        <motion.button
          onClick={onDispatch}
          disabled={dispatching}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {dispatching ? "Đang gửi..." : "Gửi alert ngay"}
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Từ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Đến</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            Xoá bộ lọc
          </button>
        )}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-600 uppercase text-xs bg-slate-50">
                <th className="px-4 py-3 font-medium">Thời gian</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium">Công ty</th>
                <th className="px-4 py-3 font-medium">Job ID</th>
                <th className="px-4 py-3 font-medium">Kênh</th>
              </tr>
            </thead>
            <tbody>
              {data?.logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {new Date(log.sent_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{log.user_full_name}</div>
                    <div className="text-xs text-slate-400">{log.user_email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{log.job_title || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{log.company_name || "—"}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://www.vietnamworks.com/--${log.source_job_id}-jd`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                    >
                      {log.source_job_id}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      {log.channel}
                    </span>
                  </td>
                </tr>
              ))}
              {data && data.logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    Chưa có alert nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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
    </AdminLayout>
  );
}
