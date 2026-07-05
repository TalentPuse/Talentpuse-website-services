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
          className="space-y-8"
        >
          {/* Row 1: Users */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Users</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Tổng người dùng" value={stats.total_users.toLocaleString()} accent="blue" />
              <KpiCard label="Đang hoạt động" value={stats.active_users.toLocaleString()} accent="green" />
              <KpiCard label="Telegram đã liên kết" value={stats.telegram_linked.toLocaleString()} accent="blue" />
              <KpiCard label="Alert subscribers" value={stats.alert_subscribers.toLocaleString()} accent="purple" />
            </div>
          </section>

          {/* Row 2: Engagement */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Engagement</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Phiên phỏng vấn" value={stats.total_interview_sessions.toLocaleString()} accent="amber" />
              <KpiCard label="Câu trả lời" value={stats.total_interview_answers.toLocaleString()} accent="amber" />
              <KpiCard label="Chat rooms" value={stats.total_chat_rooms.toLocaleString()} accent="blue" />
              <KpiCard label="Chat messages" value={stats.total_chat_messages.toLocaleString()} accent="blue" />
            </div>
          </section>

          {/* Row 3: Alerts & Jobs */}
          <section>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Alerts & Jobs</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard label="Alert hôm nay" value={stats.alerts_today.toLocaleString()} accent="amber" />
              <KpiCard label="Alert tuần này" value={stats.alerts_this_week.toLocaleString()} accent="amber" />
              <KpiCard label="Tổng alerts đã gửi" value={stats.total_alerts.toLocaleString()} accent="green" />
              <KpiCard label="Jobs đang active" value={stats.active_jobs.toLocaleString()} accent="blue" />
            </div>
          </section>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User signups chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Đăng ký user (30 ngày)</h3>
              <BarChart data={stats.user_signups_daily} color="#3b82f6" />
            </div>

            {/* Alerts daily chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Alerts gửi (30 ngày)</h3>
              <BarChart data={stats.alerts_daily} color="#f59e0b" />
            </div>
          </div>

          {/* Breakdowns Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Subscription Tier</h3>
              <DonutChart
                data={stats.tier_breakdown.map((t) => ({ label: t.tier, value: t.count }))}
                colors={["#3b82f6", "#8b5cf6", "#f59e0b"]}
              />
            </div>

            {/* Alert channel breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Alert theo kênh</h3>
              <DonutChart
                data={stats.alert_channel_breakdown.map((c) => ({ label: c.channel, value: c.count }))}
                colors={["#10b981", "#6366f1", "#ef4444"]}
              />
            </div>

            {/* Session mode breakdown */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">Interview Sessions</h3>
              <div className="space-y-2">
                {stats.session_mode_breakdown.length > 0 ? (
                  stats.session_mode_breakdown.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.mode === "practice" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"
                        }`}>
                          {s.mode}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.status === "completed" ? "bg-green-50 text-green-700" :
                          s.status === "in_progress" ? "bg-yellow-50 text-yellow-700" :
                          "bg-red-50 text-red-700"
                        }`}>
                          {s.status}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{s.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Chưa có session nào</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl skeleton" />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

/* ── Simple bar chart ── */
function BarChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Chưa có dữ liệu</p>;
  }

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartH = 160;

  return (
    <div className="flex items-end gap-[2px]" style={{ height: chartH }}>
      {data.map((d, i) => {
        const h = Math.max((d.value / maxVal) * (chartH - 20), 2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            <div
              className="w-full rounded-t-sm transition-all duration-200 hover:opacity-80"
              style={{ height: h, backgroundColor: color, minHeight: 2 }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded-sm whitespace-nowrap z-10">
              {d.date}: {d.value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Donut chart ── */
function DonutChart({ data, colors }: { data: { label: string; value: number }[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Chưa có dữ liệu</p>;
  }

  // Build SVG arcs
  const size = 120;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulated = 0;
  const segments = data.map((d, i) => {
    const pct = d.value / total;
    const dashArray = `${pct * circumference} ${(1 - pct) * circumference}`;
    const rotation = (accumulated / total) * 360 - 90;
    accumulated += d.value;
    return { ...d, pct, dashArray, rotation, color: colors[i % colors.length] };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="shrink-0">
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={s.dashArray}
            transform={`rotate(${s.rotation} ${size / 2} ${size / 2})`}
          />
        ))}
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="text-lg font-bold fill-slate-800">
          {total}
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 capitalize">{s.label}</span>
            <span className="text-slate-400 text-xs ml-auto">{s.value} ({(s.pct * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
