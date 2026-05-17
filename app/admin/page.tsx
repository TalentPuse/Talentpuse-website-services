"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";

import { adminApi, AdminStats } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import KpiCard from "@/components/KpiCard";

export default function AdminStatsPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      setStats(await adminApi.stats(token));
    } catch (err) {
      console.error("Failed to load admin stats:", err);
      setError("Không thể tải thống kê. Vui lòng thử lại.");
    }
  }, [token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <AdminLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Tổng quan hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500">Thống kê realtime — tự cập nhật mỗi 30 giây</p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={load} className="ml-3 underline font-medium hover:text-red-900">Thử lại</button>
        </div>
      )}

      {stats ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <KpiCard label="Tổng người dùng" value={stats.total_users.toLocaleString()} accent="blue" />
          <KpiCard label="Đang hoạt động" value={stats.active_users.toLocaleString()} accent="green" />
          <KpiCard label="Telegram đã liên kết" value={stats.telegram_linked.toLocaleString()} accent="blue" />
          <KpiCard label="Alert hôm nay" value={stats.alerts_today.toLocaleString()} accent="amber" />
          <KpiCard label="Alert tuần này" value={stats.alerts_this_week.toLocaleString()} accent="amber" />
          <KpiCard label="Tổng alert đã gửi" value={stats.total_alerts.toLocaleString()} accent="green" />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl skeleton" />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
