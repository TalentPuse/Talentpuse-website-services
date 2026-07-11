"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { authApi, ApiError } from "@/lib/api";
import { AI_HOME } from "@/lib/flags";
import { useAuth } from "@/context/AuthContext";
import { ForceTheme } from "@/components/theme/ForceTheme";
import AuthInput from "@/components/auth/AuthInput";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import Aurora from "@/components/brand/Aurora";
import GlowCard from "@/components/brand/GlowCard";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertCircle, ICON } from "@/lib/icons";

export default function SignInPage() {
  return (
    <>
      <ForceTheme theme="dark" />
      <Suspense>
        <SignInForm />
      </Suspense>
    </>
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function SignInForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || (AI_HOME ? "/assistant" : "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = "Vui lòng nhập email";
    else if (!isValidEmail(email)) errs.email = "Email không hợp lệ";
    if (!password) errs.password = "Vui lòng nhập mật khẩu";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
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
    <div className="flex min-h-screen bg-bg">
      <AuthBrandPanel
        headline="Đăng nhập để xem insight thị trường tuyển dụng IT/AI"
        subtext="Dashboard data realtime, AI match job theo profile của bạn, alert qua Telegram/Zalo ngay khi có việc phù hợp."
      />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-12 sm:px-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50 lg:opacity-25">
          <Aurora />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md"
        >
          {/* Mobile-only brand mark — brand panel is hidden below lg */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="ai-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
              <Sparkles {...ICON} size={16} className="text-white" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight text-text">
              Talent<span className="ai-text">Puse</span>
            </span>
          </div>

          <GlowCard glow className="p-7 sm:p-9">
            <div className="mb-7">
              <h1 className="font-display text-2xl font-semibold text-text">Đăng nhập</h1>
              <p className="mt-1.5 text-sm text-text-muted">
                Chưa có tài khoản?{" "}
                <a href="/signup" className="font-medium text-brand-400 hover:text-brand-300">
                  Đăng ký miễn phí
                </a>
              </p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
                >
                  <AlertCircle {...ICON} size={16} className="mt-0.5 shrink-0" />
                  {error}
                </motion.div>
              )}

              <AuthInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => email && setFieldErrors((f) => ({ ...f, email: isValidEmail(email) ? "" : "Email không hợp lệ" }))}
                error={fieldErrors.email}
                placeholder="you@example.com"
                required
                autoFocus
              />

              <AuthInput
                label="Mật khẩu"
                password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldErrors.password}
                placeholder="Nhập mật khẩu"
                required
              />

              <Button type="submit" disabled={loading} size="lg" className="w-full">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                    Đang đăng nhập...
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </form>
          </GlowCard>

          <div className="mt-8 text-center">
            <a href="/" className="text-xs text-text-muted hover:text-text">
              &larr; Về trang chủ
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
