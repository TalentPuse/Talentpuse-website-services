"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { adminApi, AlertLogList, AdminUserList, AlertDispatchStats, DispatchHistoryResponse } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

const PER_PAGE = 50;

function StatCard({ label, value, icon, color = "blue" }: { label: string; value: number | string; icon: string; color?: string }) {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    orange: "text-orange-600",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className={`text-2xl font-bold ${colorClasses[color as keyof typeof colorClasses]} mt-1`}>{value}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </motion.div>
  );
}

export default function AdminAlertsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AlertLogList | null>(null);
  const [stats, setStats] = useState<(AlertDispatchStats & { todayTotal: number; weekTotal: number }) | null>(null);
  const [dispatchHistory, setDispatchHistory] = useState<DispatchHistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<{ id: string; email: string; full_name: string }[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [dispatching, setDispatching] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load users for filter dropdown
  useEffect(() => {
    if (!token) return;
    adminApi.users(token, { per_page: 100, search: userSearch || undefined })
      .then((res: AdminUserList) => setUsers(res.users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))))
      .catch(() => {});
  }, [token, userSearch]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [todayStats, weekStats] = await Promise.all([
        adminApi.alertDispatchStats(token, { date_from: today }),
        adminApi.alertDispatchStats(token, { date_from: weekAgo }),
      ]);

      const todayTotal = Object.values(todayStats.channel_breakdown || {}).reduce((sum, val) => sum + val, 0);
      const weekTotal = Object.values(weekStats.channel_breakdown || {}).reduce((sum, val) => sum + val, 0);

      setStats({
        channel_breakdown: todayStats.channel_breakdown,
        failed_emails: todayStats.failed_emails,
        source_breakdown: todayStats.source_breakdown,
        todayTotal,
        weekTotal,
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminApi.alertLogs(token, {
        page,
        per_page: PER_PAGE,
        user_id: selectedUserId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        channel: channelFilter !== "all" ? channelFilter : undefined,
        search: search || undefined,
      });
      setData(res);
    } catch (err) {
      console.error("Failed to load alert logs:", err);
    }
  }, [token, page, selectedUserId, dateFrom, dateTo, channelFilter, search]);

  const loadDispatchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminApi.dispatchHistory(token, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page: 1,
        per_page: 10,
      });
      setDispatchHistory(res);
    } catch (err) {
      console.error("Failed to load dispatch history:", err);
    }
  }, [token, dateFrom, dateTo]);

  useEffect(() => {
    load();
    loadStats();
    loadDispatchHistory();
  }, [load, loadStats, loadDispatchHistory]);

  async function onDispatch() {
    if (!token) return;
    setDispatching(true);
    try {
      const res = await adminApi.dispatchAlerts(token);
      toast.success(`Đã gửi ${res.dispatched} alert`);
      load();
      loadStats();
    } catch {
      toast.error("Dispatch thất bại");
    } finally {
      setDispatching(false);
    }
  }

  async function onRetry() {
    if (!token) return;
    setRetrying(true);
    try {
      const res = await adminApi.retryFailedAlerts(token, {
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      toast.success(`Đã retry ${res.retried}/${res.total} alerts`);
      load();
      loadStats();
    } catch {
      toast.error("Retry thất bại");
    } finally {
      setRetrying(false);
    }
  }

  async function onEmailTest() {
    if (!token) return;
    const email = testEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email không hợp lệ");
      return;
    }
    setSendingTest(true);
    try {
      const res = await adminApi.emailTest(token, email);
      toast.success(`Đã gửi email test đến ${res.to} (id: ${res.message_id?.slice(0, 8)}…)`);
    } catch (err) {
      const msg = (err as { message?: string })?.message || "Gửi email test thất bại";
      toast.error(msg);
    } finally {
      setSendingTest(false);
    }
  }

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Search will trigger via useEffect dependency on search
    }, 300);
  };

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;
  const hasFilters = dateFrom || dateTo || selectedUserId || channelFilter !== "all" || search;
  const successRate = stats && stats.todayTotal > 0
    ? Math.round((stats.todayTotal - (stats.failed_emails || 0)) / stats.todayTotal * 100)
    : 100;

  return (
    <AdminLayout>
      {/* Stats Overview Cards */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      >
        <StatCard label="Alerts hôm nay" value={stats?.todayTotal || 0} icon="🔔" />
        <StatCard label="Tuần này" value={stats?.weekTotal || 0} icon="📊" />
        <StatCard label="Email failed" value={stats?.failed_emails || 0} icon="❌" color="red" />
        <StatCard label="Success rate" value={`${successRate}%`} icon="✅" color="green" />
      </motion.div>

      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Alert Logs</h1>
          <p className="mt-1 text-sm text-slate-500">
            {data ? `${data.total} alert đã gửi` : "Đang tải..."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Email test */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Gửi email test</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onEmailTest(); }}
                placeholder="email@example.com"
                className="w-56 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <motion.button
                onClick={onEmailTest}
                disabled={sendingTest}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:opacity-60 transition-colors"
              >
                {sendingTest ? "Đang gửi..." : "Gửi test"}
              </motion.button>
            </div>
          </div>
          {/* Retry failed */}
          <motion.button
            onClick={onRetry}
            disabled={retrying}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60 transition-colors"
          >
            {retrying ? "Đang retry..." : `Retry Failed (${stats?.failed_emails || 0})`}
          </motion.button>
          {/* Dispatch all */}
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
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 mb-6">
        {/* Search */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tìm kiếm</label>
          <input
            type="text"
            placeholder="Job title, company..."
            value={search}
            onChange={onSearchChange}
            className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        {/* User filter */}
        <div className="min-w-[220px]">
          <label className="block text-xs text-slate-500 mb-1">User</label>
          <select
            value={selectedUserId}
            onChange={(e) => { setSelectedUserId(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">Tất cả users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {/* Channel filter */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">Kênh</label>
          <select
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="all">Tất cả kênh</option>
            <option value="telegram">Telegram</option>
            <option value="email">Email</option>
            <option value="website">Website</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">Từ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Đến</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setSelectedUserId("");
              setDateFrom("");
              setDateTo("");
              setChannelFilter("all");
              setSearch("");
              setPage(1);
            }}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium pb-1"
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
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      log.channel === "telegram" ? "bg-blue-50 text-blue-700" :
                      log.channel === "email" ? "bg-green-50 text-green-700" :
                      "bg-gray-50 text-gray-700"
                    }`}>
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

      {/* Dispatch History */}
      {dispatchHistory && dispatchHistory.entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-4">Dispatch History</h3>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-200 text-slate-600 uppercase text-xs bg-slate-50">
                    <th className="px-4 py-3 font-medium">Ngày</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Jobs sent</th>
                    <th className="px-4 py-3 font-medium">Telegram</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatchHistory.entries.map((entry, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {entry.date ? new Date(entry.date).toLocaleDateString("vi-VN") : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <span className="inline-block rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {entry.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{entry.jobs_sent}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.telegram_sent}</td>
                      <td className="px-4 py-3 text-slate-700">{entry.email_sent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </AdminLayout>
  );
}
