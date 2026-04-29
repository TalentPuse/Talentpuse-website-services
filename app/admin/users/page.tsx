"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { adminApi, AdminUserRow, AdminUserList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

const TIERS = ["free", "pro", "enterprise"];
const PER_PAGE = 20;

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [data, setData] = useState<AdminUserList | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminApi.users(token, {
        page,
        per_page: PER_PAGE,
        search: search || undefined,
        is_active: statusFilter === "all" ? null : statusFilter === "active",
        tier: tierFilter === "all" ? null : tierFilter,
      });
      setData(res);
    } catch {}
  }, [token, page, search, statusFilter, tierFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function onSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {}, 300);
  }

  async function onToggleActive(user: AdminUserRow) {
    if (!token) return;
    const action = user.is_active ? "ban" : "unban";
    if (!confirm(`Bạn có chắc muốn ${action} user ${user.email}?`)) return;
    try {
      await adminApi.toggleUserActive(token, user.id, !user.is_active);
      toast.success(`Đã ${action} ${user.email}`);
      load();
    } catch {
      toast.error("Thao tác thất bại");
    }
  }

  async function onChangeTier(user: AdminUserRow, newTier: string) {
    if (!token || newTier === user.subscription_tier) return;
    try {
      await adminApi.updateUserTier(token, user.id, newTier);
      toast.success(`Đã đổi gói ${user.email} → ${newTier}`);
      load();
    } catch {
      toast.error("Đổi gói thất bại");
    }
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <AdminLayout>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Quản lý người dùng</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data ? `${data.total} người dùng` : "Đang tải..."}
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm theo email hoặc tên..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Active</option>
          <option value="banned">Banned</option>
        </select>
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="all">Tất cả gói</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
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
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Tên</th>
                <th className="px-4 py-3 font-medium">Gói</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Telegram</th>
                <th className="px-4 py-3 font-medium text-right">Alerts</th>
                <th className="px-4 py-3 font-medium">Ngày tạo</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u, idx) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-400">{(page - 1) * PER_PAGE + idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                  <td className="px-4 py-3 text-slate-600">{u.full_name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.subscription_tier}
                      onChange={(e) => onChangeTier(u, e.target.value)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs outline-none"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700"
                    }`}>
                      {u.is_active ? "Active" : "Banned"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.telegram_status ? (
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        u.telegram_status === "active"
                          ? "bg-blue-50 text-blue-700"
                          : u.telegram_status === "pending"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {u.telegram_status}
                        {u.telegram_username ? ` @${u.telegram_username}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{u.alerts_sent}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {new Date(u.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggleActive(u)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        u.is_active
                          ? "bg-red-50 text-red-600 hover:bg-red-100"
                          : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {u.is_active ? "Ban" : "Unban"}
                    </button>
                  </td>
                </tr>
              ))}
              {data && data.users.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    Không tìm thấy người dùng nào
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
