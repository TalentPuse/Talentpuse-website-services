"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { adminApi, SystemConfig } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

export default function AdminConfigPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [interval, setInterval_] = useState("");
  const [loopActive, setLoopActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const c = await adminApi.getConfig(token);
      setConfig(c);
      setInterval_(String(c.alert_interval_seconds));
      setLoopActive(c.alert_loop_active);
      setDirty(false);
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSave() {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await adminApi.updateConfig(token, {
        alert_interval_seconds: Number(interval),
        alert_loop_active: loopActive,
      });
      setConfig(updated);
      setDirty(false);
      toast.success("Đã lưu cấu hình");
    } catch {
      toast.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Cấu hình hệ thống</h1>
        <p className="mt-1 text-sm text-slate-500">Quản lý cấu hình runtime cho alert và Telegram bot</p>
      </header>

      {config ? (
        <div className="space-y-6 max-w-xl">
          {/* Alert Interval */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Alert Loop</h2>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-700">
                  Interval (giây)
                </label>
                <input
                  type="number"
                  value={interval}
                  onChange={(e) => { setInterval_(e.target.value); setDirty(true); }}
                  min={60}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
                {interval && Number(interval) >= 60 && (
                  <p className="text-xs text-slate-400">= {formatDuration(Number(interval))}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-700">Alert loop</span>
                  <p className="text-xs text-slate-400">
                    {loopActive ? "Đang chạy" : "Đã tạm dừng"}
                  </p>
                </div>
                <button
                  onClick={() => { setLoopActive(!loopActive); setDirty(true); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    loopActive ? "bg-brand-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      loopActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {dirty && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="pt-2"
                >
                  <motion.button
                    onClick={onSave}
                    disabled={saving}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 transition-colors"
                  >
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </motion.button>
                  <p className="mt-2 text-xs text-amber-600">
                    Thay đổi chỉ có hiệu lực trong phiên chạy hiện tại. Restart server sẽ reset về giá trị .env
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Telegram Info (read-only) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Telegram Bot</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Username</span>
                <span className="text-sm font-medium text-slate-900">@{config.telegram_bot_username}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Token configured</span>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  config.telegram_bot_configured
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {config.telegram_bot_configured ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </motion.div>

          {/* CORS Origins (read-only) */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <h2 className="text-lg font-semibold text-slate-900 mb-4">CORS Origins</h2>
            <div className="space-y-2">
              {config.cors_origins.map((origin) => (
                <div
                  key={origin}
                  className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700 font-mono"
                >
                  {origin}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="space-y-6 max-w-xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl skeleton" />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
