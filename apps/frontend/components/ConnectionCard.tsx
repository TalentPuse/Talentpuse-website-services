"use client";

import { motion } from "framer-motion";
import { toast } from "sonner";
import { useCallback, useEffect, useState } from "react";

import { telegramApi, TelegramStatus } from "@/lib/api";

type ConnectionCardProps = {
  icon: React.ReactNode;
  name: string;
  description: string;
  color: string; // e.g. "sky" for sky-500
  bgColor: string; // e.g. "sky" for sky-50
  comingSoon?: boolean;
  token?: string;
};

export default function ConnectionCard({
  icon,
  name,
  description,
  color,
  bgColor,
  comingSoon,
  token,
}: ConnectionCardProps) {
  if (comingSoon) return <ComingSoonCard icon={icon} name={name} description={description} color={color} bgColor={bgColor} />;
  if (name === "Telegram" && token) return <TelegramCard token={token} icon={icon} name={name} description={description} color={color} bgColor={bgColor} />;
  return null;
}

/* ── Telegram (live) ── */

function TelegramCard({ token, icon, name, description, color, bgColor }: { token: string; icon: React.ReactNode; name: string; description: string; color: string; bgColor: string }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const s = await telegramApi.getStatus(token);
      setStatus(s);
      return s;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (!polling) return;
    let count = 0;
    const interval = setInterval(async () => {
      count++;
      const s = await fetchStatus();
      if (s?.linked || count >= 20) {
        setPolling(false);
        clearInterval(interval);
        if (s?.linked) toast.success("Telegram đã kết nối thành công!");
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  async function handleLink() {
    setLinking(true);
    try {
      const { deep_link } = await telegramApi.createLink(token);
      window.open(deep_link, "_blank");
      toast("Mở Telegram và nhấn Start để kết nối.", { icon: "📱" });
      setPolling(true);
    } catch {
      toast.error("Không thể tạo liên kết. Vui lòng thử lại.");
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    setUnlinking(true);
    try {
      await telegramApi.unlink(token);
      await fetchStatus();
      toast.success("Đã huỷ kết nối Telegram.");
    } catch {
      toast.error("Không thể huỷ kết nối.");
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return <div className="h-48 rounded-2xl bg-white border border-slate-200 animate-pulse" />;
  }

  const linked = status?.linked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl shadow-xs hover:shadow-md border border-slate-200 p-5 transition-shadow duration-300 flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 rounded-xl bg-${bgColor}-50 text-${color}-500 flex items-center justify-center`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900">{name}</h3>
          <p className="text-xs text-slate-500 truncate">{description}</p>
        </div>
      </div>

      {linked ? (
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 font-medium">Đã kết nối</span>
              {status?.telegram_username && (
                <span className="text-slate-500">@{status.telegram_username}</span>
              )}
            </div>
            {status?.linked_at && (
              <p className="text-xs text-slate-400">
                Từ {new Date(status.linked_at).toLocaleDateString("vi-VN")}
              </p>
            )}
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              status?.job_alert_enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}>
              {status?.job_alert_enabled ? "Alert đang bật" : "Alert đã tắt"}
            </span>
          </div>
          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="mt-4 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50 self-start"
          >
            {unlinking ? "Đang huỷ..." : "Huỷ kết nối"}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between">
          <p className="text-sm text-slate-500 mb-4">
            Nhận alert việc làm qua Telegram khi có job phù hợp.
          </p>
          <motion.button
            onClick={handleLink}
            disabled={linking || polling}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full rounded-xl bg-${color}-500 px-4 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-${color}-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2`}
          >
            {polling ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang chờ kết nối...
              </>
            ) : linking ? (
              "Đang tạo liên kết..."
            ) : (
              <>
                {icon}
                Kết nối Telegram
              </>
            )}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}

/* ── Coming Soon (Zalo / Discord) ── */

function ComingSoonCard({ icon, name, description, color, bgColor }: Omit<ConnectionCardProps, "comingSoon" | "token">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="relative bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col overflow-hidden"
    >
      {/* Coming soon overlay */}
      <div className="absolute top-3 right-3">
        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-semibold tracking-wide">
          Coming soon
        </span>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-11 h-11 rounded-xl bg-${bgColor}-50 text-${color}-400 flex items-center justify-center opacity-60`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-slate-400">{name}</h3>
          <p className="text-xs text-slate-400">{description}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center py-4">
          <div className={`w-12 h-12 mx-auto mb-3 rounded-full bg-${bgColor}-50 flex items-center justify-center opacity-40`}>
            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
          <p className="text-sm text-slate-400 font-medium">Sắp ra mắt</p>
          <p className="text-xs text-slate-300 mt-1">Đang phát triển tích hợp {name}</p>
        </div>
      </div>
    </motion.div>
  );
}
