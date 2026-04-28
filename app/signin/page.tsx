"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthInput from "@/components/auth/AuthInput";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { access_token } = await authApi.login(email, password);
      const user = await authApi.getMe(access_token);
      login(access_token, user);
      toast.success(`Chào mừng trở lại, ${user.full_name}!`);
      router.push(redirect);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel
        headline="Đăng nhập để xem insight thị trường tuyển dụng IT/AI"
        subtext="Dashboard data realtime, AI match job theo profile của bạn, alert qua Telegram/Zalo ngay khi có việc phù hợp."
      />

      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900">Đăng nhập</h2>
            <p className="mt-1 text-sm text-slate-500">
              Chưa có tài khoản?{" "}
              <a
                href="/signup"
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Đăng ký miễn phí
              </a>
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600"
              >
                {error}
              </motion.div>
            )}

            <AuthInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoFocus
            />

            <AuthInput
              label="Mật khẩu"
              password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              required
            />

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
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
                  Đang đăng nhập...
                </span>
              ) : (
                "Đăng nhập"
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center">
            <a href="/" className="text-xs text-slate-400 hover:text-slate-600">
              &larr; Về trang chủ
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
