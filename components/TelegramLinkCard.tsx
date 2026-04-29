"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { telegramApi, TelegramStatus } from "@/lib/api";

const TG_ICON = (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

export default function TelegramLinkCard({ token }: { token: string }) {
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

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

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
    return <div className="skeleton h-40 w-full" />;
  }

  const linked = status?.linked;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-white rounded-xl shadow-sm hover:shadow-md border border-slate-200 p-6 transition-shadow duration-300"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center">
          {TG_ICON}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Thông báo Telegram</h3>
          <p className="text-xs text-slate-500">
            Nhận alert việc làm phù hợp qua Telegram
          </p>
        </div>
      </div>

      {linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-700 font-medium">Đã kết nối</span>
            {status?.telegram_username && (
              <span className="text-slate-500">
                @{status.telegram_username}
              </span>
            )}
          </div>

          {status?.linked_at && (
            <p className="text-xs text-slate-400">
              Kết nối từ{" "}
              {new Date(status.linked_at).toLocaleDateString("vi-VN")}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                status?.job_alert_enabled
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {status?.job_alert_enabled
                ? "Alert đang bật"
                : "Alert đã tắt"}
            </span>
          </div>

          <button
            onClick={handleUnlink}
            disabled={unlinking}
            className="mt-2 text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
          >
            {unlinking ? "Đang huỷ..." : "Huỷ kết nối Telegram"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Kết nối Telegram để nhận thông báo khi có việc làm phù hợp với kỹ
            năng và mức lương mong muốn của bạn.
          </p>

          <motion.button
            onClick={handleLink}
            disabled={linking || polling}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {polling ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Đang chờ kết nối...
              </>
            ) : linking ? (
              "Đang tạo liên kết..."
            ) : (
              <>
                {TG_ICON}
                Kết nối Telegram
              </>
            )}
          </motion.button>
        </div>
      )}
    </motion.div>
  );
}
