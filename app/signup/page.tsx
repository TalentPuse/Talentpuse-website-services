"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";

import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthInput from "@/components/auth/AuthInput";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import SkillTagInput from "@/components/auth/SkillTagInput";
import CityPillSelect from "@/components/auth/CityPillSelect";
import TitlePillSelect from "@/components/auth/TitlePillSelect";

export default function SignUpPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Step 2
  const [desiredTitles, setDesiredTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [cities, setCities] = useState<string[]>([]);

  function validateStep1(): boolean {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Vui lòng nhập họ tên";
    if (!email.trim()) errs.email = "Vui lòng nhập email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Email không hợp lệ";
    if (password.length < 8) errs.password = "Mật khẩu phải có ít nhất 8 ký tự";
    if (password !== confirm) errs.confirm = "Mật khẩu xác nhận không khớp";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goStep2(e: FormEvent) {
    e.preventDefault();
    if (validateStep1()) setStep(2);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        full_name: fullName,
        skills,
        desired_salary_min: salaryMin ? Number(salaryMin) * 1_000_000 : undefined,
        desired_salary_max: salaryMax ? Number(salaryMax) * 1_000_000 : undefined,
        preferred_cities: cities,
        desired_titles: desiredTitles,
      };
      const { access_token } = await authApi.signup(payload);
      const user = await authApi.getMe(access_token);
      login(access_token, user);
      toast.success("Chào mừng bạn đến TalentPulse!");
      router.push("/dashboard");
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function skipAndSubmit() {
    setDesiredTitles([]);
    setSkills([]);
    setSalaryMin("");
    setSalaryMax("");
    setCities([]);
    setError("");
    setLoading(true);

    try {
      const payload = {
        email,
        password,
        full_name: fullName,
        skills: [],
        preferred_cities: [],
        desired_titles: [],
      };
      const { access_token } = await authApi.signup(payload);
      const user = await authApi.getMe(access_token);
      login(access_token, user);
      toast.success("Chào mừng bạn đến TalentPulse!");
      router.push("/dashboard");
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="min-h-screen flex">
      <AuthBrandPanel
        headline="Tạo tài khoản để AI match job cho bạn"
        subtext="Thiết lập profile skills, mức lương mong muốn — AI sẽ alert ngay khi có việc phù hợp qua Telegram, Zalo, Discord."
      />

      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-white">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Đăng ký</h2>
            <p className="mt-1 text-sm text-slate-500">
              Đã có tài khoản?{" "}
              <a
                href="/signin"
                className="text-brand-600 hover:text-brand-700 font-medium"
              >
                Đăng nhập
              </a>
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-medium ${step >= 1 ? "text-brand-600" : "text-slate-400"}`}>
                Tài khoản
              </span>
              <div className="flex-1 h-px bg-slate-200" />
              <span className={`text-xs font-medium ${step >= 2 ? "text-brand-600" : "text-slate-400"}`}>
                Hồ sơ
              </span>
            </div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full"
                initial={{ width: "50%" }}
                animate={{ width: step === 1 ? "50%" : "100%" }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600 mb-4"
            >
              {error}
            </motion.div>
          )}

          <AnimatePresence mode="wait" custom={step}>
            {step === 1 ? (
              <motion.form
                key="step1"
                custom={1}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                onSubmit={goStep2}
                className="space-y-4"
              >
                <AuthInput
                  label="Họ và tên"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  error={fieldErrors.fullName}
                  required
                  autoFocus
                />
                <AuthInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  error={fieldErrors.email}
                  required
                />
                <AuthInput
                  label="Mật khẩu"
                  password
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 8 ký tự"
                  error={fieldErrors.password}
                  required
                />
                <AuthInput
                  label="Xác nhận mật khẩu"
                  password
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  error={fieldErrors.confirm}
                  required
                />

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
                >
                  Tiếp tục
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="step2"
                custom={2}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3 }}
                onSubmit={onSubmit}
                className="space-y-5"
              >
                <p className="text-sm text-slate-500">
                  Thiết lập profile để AI match job chính xác hơn.
                  Bạn có thể bỏ qua và cập nhật sau.
                </p>

                <TitlePillSelect value={desiredTitles} onChange={setDesiredTitles} />

                <SkillTagInput value={skills} onChange={setSkills} />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Mức lương mong muốn (triệu VND/tháng)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      value={salaryMin}
                      onChange={(e) => setSalaryMin(e.target.value)}
                      placeholder="Từ (VD: 20)"
                      className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                    />
                    <input
                      type="number"
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      placeholder="Đến (VD: 40)"
                      className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <CityPillSelect value={cities} onChange={setCities} />

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Quay lại
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.01, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 transition-colors"
                  >
                    {loading ? "Đang tạo tài khoản..." : "Hoàn tất đăng ký"}
                  </motion.button>
                </div>
                <button
                  type="button"
                  onClick={skipAndSubmit}
                  disabled={loading}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition"
                >
                  Bỏ qua, tôi sẽ cập nhật sau
                </button>
              </motion.form>
            )}
          </AnimatePresence>

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
