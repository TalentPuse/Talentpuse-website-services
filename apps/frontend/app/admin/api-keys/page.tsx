"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { adminApi, ApiKeyRecord } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";

export default function AdminApiKeysPage() {
  const { token } = useAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [quota, setQuota] = useState(10000);
  const [expiryDays, setExpiryDays] = useState<number | "">(""); // "" = khong het han
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<{ api_key: string; name: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [adjustDays, setAdjustDays] = useState<number | "">(30);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await adminApi.listApiKeys(token);
      setKeys(res.keys);
    } catch {
      toast.error("Không tải được danh sách key");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate() {
    if (!token || !name.trim()) return;
    setCreating(true);
    try {
      const expiresAt = expiryDays === "" || !expiryDays
        ? null
        : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const res = await adminApi.createApiKey(token, { name: name.trim(), quota_month: Math.max(1, quota), expires_at: expiresAt });
      setNewKey(res);
      setName("");
      toast.success("Đã tạo key — copy key thô NGAY (chỉ hiện 1 lần)");
      load();
    } catch {
      toast.error("Tạo key thất bại");
    } finally {
      setCreating(false);
    }
  }

  async function onAdjustExpiry(k: ApiKeyRecord) {
    if (!token || adjusting !== k.id) return;
    try {
      const expiresAt = adjustDays === "" || !adjustDays
        ? null
        : new Date(Date.now() + adjustDays * 24 * 60 * 60 * 1000).toISOString();
      await adminApi.updateApiKeyExpiry(token, k.id, expiresAt);
      toast.success(expiresAt ? `Hạn key: ${new Date(expiresAt).toLocaleDateString("vi-VN")}` : "Key không còn hạn");
      load();
    } catch {
      toast.error("Điều chỉnh hạn thất bại");
    } finally {
      setAdjusting(null);
    }
  }

  async function onRevoke(k: ApiKeyRecord) {
    if (!token) return;
    if (!confirm(`Thu hồi key "${k.name}"? Khách sẽ không gọi API được nữa.`)) return;
    setRevoking(k.id);
    try {
      await adminApi.revokeApiKey(token, k.id);
      toast.success("Đã thu hồi key");
      load();
    } catch {
      toast.error("Thu hồi thất bại");
    } finally {
      setRevoking(null);
    }
  }

  const totalQuota = keys?.reduce((s, k) => s + k.quota_month, 0) || 0;
  const totalUsed = keys?.reduce((s, k) => s + k.used_count, 0) || 0;
  const activeCount = keys?.filter((k) => k.is_active).length || 0;

  return (
    <AdminLayout>
      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"
      >
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Tổng key</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{keys?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Key đang hoạt động</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Quota đã dùng (tháng này)</p>
          <p className="text-2xl font-bold text-brand-600 mt-1">{totalUsed.toLocaleString("vi-VN")}</p>
        </div>
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Tổng quota (tháng này)</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalQuota.toLocaleString("vi-VN")}</p>
        </div>
      </motion.div>

      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Insight API Keys</h1>
          <p className="mt-1 text-sm text-slate-500">
            Key bán hàng cho khách gọi <code className="text-xs bg-slate-100 px-1 rounded">/api/v1/*</code> qua header <code className="text-xs bg-slate-100 px-1 rounded">X-API-Key</code>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tên khách</label>
            <input
              type="text"
              placeholder="VD: Công ty ABC"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Quota/tháng</label>
            <input
              type="number"
              min={1}
              value={quota}
              onChange={(e) => setQuota(Number(e.target.value))}
              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hạn (ngày)</label>
            <input
              type="number"
              min={1}
              placeholder="0 = vĩnh viễn"
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
          <motion.button
            onClick={onCreate}
            disabled={creating || !name.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Đang tạo..." : "+ Tạo key"}
          </motion.button>
        </div>
      </div>

      {/* New key modal */}
      {newKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
          >
            <h3 className="text-lg font-bold text-slate-900">Key mới — COPY NGAY</h3>
            <p className="mt-1 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Key thô chỉ hiện ĐÚNG 1 lần. Không lưu được lại — hãy gửi cho khách ngay bây giờ.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 break-all rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800">
                {newKey.api_key}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKey.api_key);
                  toast.success("Đã copy key");
                }}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setNewKey(null)}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Đã lưu xong
            </button>
          </motion.div>
        </div>
      )}

      {/* Keys table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 text-slate-600 uppercase text-xs bg-slate-50">
                <th className="px-4 py-3 font-medium">Khách hàng</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Đã dùng / Quota</th>
                <th className="px-4 py-3 font-medium">%</th>
                <th className="px-4 py-3 font-medium">Hết hạn</th>
                <th className="px-4 py-3 font-medium">Reset quota</th>
                <th className="px-4 py-3 font-medium">Tạo lúc</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {keys?.map((k) => {
                const pct = k.quota_month > 0 ? Math.round((k.used_count / k.quota_month) * 100) : 0;
                const pctColor = pct >= 90 ? "bg-red-500" : pct >= 60 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-800">{k.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        k.is_active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                      }`}>
                        {k.is_active ? "active" : "revoked"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {k.used_count.toLocaleString("vi-VN")} / {k.quota_month.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${pctColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {k.expires_at ? (
                        <span className={`text-xs font-medium ${
                          new Date(k.expires_at) < new Date() ? "text-red-600" : "text-slate-600"
                        }`}>
                          {new Date(k.expires_at).toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">vĩnh viễn</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {k.quota_reset_at ? new Date(k.quota_reset_at).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {k.created_at ? new Date(k.created_at).toLocaleString("vi-VN") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {k.is_active && (
                        <div className="flex items-center gap-2">
                          {adjusting === k.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                value={adjustDays}
                                onChange={(e) => setAdjustDays(e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-xs outline-hidden"
                              />
                              <button
                                onClick={() => onAdjustExpiry(k)}
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => setAdjusting(null)}
                                className="text-xs text-slate-400"
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => { setAdjusting(k.id); setAdjustDays(k.expires_at ? Math.max(1, Math.ceil((new Date(k.expires_at).getTime() - Date.now()) / 86400000)) : 30); }}
                                className="text-xs font-medium text-emerald-600 hover:text-emerald-800"
                              >
                                Chỉnh hạn
                              </button>
                              <button
                                onClick={() => onRevoke(k)}
                                disabled={revoking === k.id}
                                className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40"
                              >
                                {revoking === k.id ? "..." : "Thu hồi"}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {keys && keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Chưa có key nào — tạo key đầu tiên ở trên
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </AdminLayout>
  );
}
