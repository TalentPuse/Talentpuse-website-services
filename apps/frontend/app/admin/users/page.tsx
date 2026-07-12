"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { adminApi, AdminUserRow, AdminUserList, AdminUserProfile } from "@/lib/api";
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

  // Profile panel
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

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
    } catch (err) {
      console.error("Failed to load users:", err);
    }
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
      if (profile?.id === user.id) {
        const p = await adminApi.getUserProfile(token, user.id);
        setProfile(p);
      }
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
      if (profile?.id === user.id) {
        const p = await adminApi.getUserProfile(token, user.id);
        setProfile(p);
      }
    } catch {
      toast.error("Đổi gói thất bại");
    }
  }

  async function openProfile(userId: string) {
    if (!token) return;
    setProfileLoading(true);
    try {
      const p = await adminApi.getUserProfile(token, userId);
      setProfile(p);
    } catch {
      toast.error("Không thể tải profile");
    } finally {
      setProfileLoading(false);
    }
  }

  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 0;

  return (
    <AdminLayout>
      <div className="flex h-full">
        {/* Main table */}
        <div className={`flex-1 min-w-0 ${profile ? "mr-0" : ""}`}>
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
                    <tr
                      key={u.id}
                      onClick={() => openProfile(u.id)}
                      className={`border-b border-slate-100 hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        profile?.id === u.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-400">{(page - 1) * PER_PAGE + idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{u.email}</td>
                      <td className="px-4 py-3 text-slate-600">{u.full_name}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
        </div>

        {/* Profile panel */}
        <AnimatePresence>
          {profile && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-[400px] shrink-0 border-l border-slate-200 bg-white overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
                <button
                  onClick={() => setProfile(null)}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {profileLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="p-4 space-y-5 text-sm">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">
                      {profile.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{profile.full_name}</p>
                      <p className="text-xs text-slate-500">{profile.email}</p>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                    }`}>
                      {profile.is_active ? "Active" : "Banned"}
                    </span>
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                      {profile.subscription_tier}
                    </span>
                    {profile.is_admin && (
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium bg-purple-50 text-purple-700">
                        Admin
                      </span>
                    )}
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoField label="Kinh nghiệm" value={profile.experience_level} />
                    <InfoField label="Trường" value={profile.university} />
                    <InfoField label="Tốt nghiệp" value={profile.graduation_year?.toString()} />
                    <InfoField label="Thực tập" value={profile.open_to_internship ? "Có" : "Không"} />
                    <InfoField label="Part-time" value={profile.part_time_ok ? "Có" : "Không"} />
                    <InfoField label="Alerts đã gửi" value={profile.alerts_sent.toString()} />
                  </div>

                  {/* Salary */}
                  {(profile.desired_salary_min || profile.desired_salary_max) && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Mức lương mong muốn</p>
                      <p className="text-slate-800">
                        {profile.desired_salary_min?.toLocaleString("vi-VN") ?? "—"}
                        {" — "}
                        {profile.desired_salary_max?.toLocaleString("vi-VN") ?? "—"} VND
                      </p>
                    </div>
                  )}

                  {/* Skills */}
                  {profile.skills.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.skills.map((s) => (
                          <span key={s} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Desired titles */}
                  {profile.desired_titles.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">Vị trí mong muốn</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.desired_titles.map((t) => (
                          <span key={t} className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preferred cities */}
                  {profile.preferred_cities.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1.5">Thành phố ưu tiên</p>
                      <div className="flex flex-wrap gap-1.5">
                        {profile.preferred_cities.map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 text-xs">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Telegram */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Telegram</p>
                    {profile.telegram_status ? (
                      <p className="text-slate-700">
                        {profile.telegram_status === "active" ? "Đã liên kết" : profile.telegram_status}
                        {profile.telegram_username && (
                          <span className="text-slate-500 ml-1">@{profile.telegram_username}</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-slate-400">Chưa liên kết</p>
                    )}
                  </div>

                  {/* CV */}
                  {profile.cv_file_url && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">CV</p>
                      <a
                        href={profile.cv_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Xem CV
                      </a>
                    </div>
                  )}

                  {/* Alert */}
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Job Alert</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      profile.alert_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {profile.alert_enabled ? "Đã bật" : "Tắt"}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="pt-3 border-t border-slate-100 space-y-1">
                    <p className="text-xs text-slate-400">
                      Tạo: {new Date(profile.created_at).toLocaleString("vi-VN")}
                    </p>
                    {profile.updated_at && (
                      <p className="text-xs text-slate-400">
                        Cập nhật: {new Date(profile.updated_at).toLocaleString("vi-VN")}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-slate-800">{value || "—"}</p>
    </div>
  );
}
