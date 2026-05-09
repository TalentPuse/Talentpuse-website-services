"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";

import { authApi, cvApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import AuthInput from "@/components/auth/AuthInput";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import SkillPillSelect from "@/components/auth/SkillPillSelect";
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
  const [experienceLevel, setExperienceLevel] = useState("");
  const [desiredTitles, setDesiredTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [cities, setCities] = useState<string[]>([]);

  // Step 2 — student fields
  const [university, setUniversity] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [openToInternship, setOpenToInternship] = useState(false);
  const [partTimeOk, setPartTimeOk] = useState(false);

  // CV upload
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState("");

  async function handleCvUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setCvError("Chỉ hỗ trợ file PDF");
      return;
    }
    setCvLoading(true);
    setCvError("");
    try {
      // Need token — but user isn't signed up yet. Use step 1 data to signup first, then upload.
      // Actually, we'll signup with empty profile, upload CV, then update profile.
      const { access_token } = await authApi.signup({
        email,
        password,
        full_name: fullName,
        skills: [],
        preferred_cities: [],
        desired_titles: [],
      });
      const res = await cvApi.upload(access_token, file);
      if (res.error) {
        setCvError(res.error);
        setCvLoading(false);
        return;
      }
      const d = res.extracted;
      if (d.full_name) setFullName(d.full_name);
      if (d.skills?.length) setSkills(d.skills);
      if (d.desired_titles?.length) setDesiredTitles(d.desired_titles);
      if (d.preferred_cities?.length) setCities(d.preferred_cities);
      if (d.experience_level) setExperienceLevel(d.experience_level);
      if (d.salary_min_m) setSalaryMin(String(d.salary_min_m));
      if (d.salary_max_m) setSalaryMax(String(d.salary_max_m));
      if (d.education?.[0]?.university) setUniversity(d.education[0].university);
      if (d.education?.[0]?.graduation_year) setGraduationYear(String(d.education[0].graduation_year));
      // Auto-login and redirect
      const user = await authApi.getMe(access_token);
      login(access_token, user);
      toast.success("CV đã được phân tích! Kiểm tra và cập nhật profile của bạn.");
      router.push("/profile");
    } catch (err) {
      const apiErr = err as ApiError;
      setCvError(apiErr.message || "Không thể phân tích CV");
    } finally {
      setCvLoading(false);
    }
  }

  const EXPERIENCE_OPTIONS = [
    { value: "student", label: "Sinh viên" },
    { value: "fresher", label: "Fresher (< 1 năm)" },
    { value: "experienced", label: "Experienced (1-5 năm)" },
    { value: "manager", label: "Manager (> 5 năm)" },
  ];

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
        experience_level: experienceLevel || undefined,
        university: university || undefined,
        graduation_year: graduationYear ? Number(graduationYear) : undefined,
        open_to_internship: openToInternship || undefined,
        part_time_ok: partTimeOk || undefined,
      };
      const { access_token } = await authApi.signup(payload);
      const user = await authApi.getMe(access_token);
      login(access_token, user);
      toast.success("Chào mừng bạn đến TalentPuse!");
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
      toast.success("Chào mừng bạn đến TalentPuse!");
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

                {/* CV Upload */}
                <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 text-center hover:border-brand-400 transition-colors">
                  {cvLoading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-sm text-slate-600">Đang phân tích CV...</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700 mb-1">
                        Upload CV (PDF) — AI tự động điền profile
                      </p>
                      <p className="text-xs text-slate-400 mb-3">
                        Hỗ trợ file PDF, tối đa 5MB
                      </p>
                      <label className="inline-block cursor-pointer rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
                        Chọn file PDF
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCvUpload(f);
                          }}
                        />
                      </label>
                      {cvError && (
                        <p className="mt-2 text-xs text-red-500">{cvError}</p>
                      )}
                    </>
                  )}
                </div>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400 font-medium">hoặc điền tay</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Cấp độ kinh nghiệm
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EXPERIENCE_OPTIONS.map((opt) => {
                      const active = experienceLevel === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          type="button"
                          whileTap={{ scale: 0.95 }}
                          onClick={() =>
                            setExperienceLevel(active ? "" : opt.value)
                          }
                          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 border ${
                            active
                              ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                              : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
                          }`}
                        >
                          {opt.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {experienceLevel === "student" && (
                  <div className="space-y-3 p-4 rounded-lg bg-indigo-50/50 border border-indigo-100">
                    <p className="text-sm font-semibold text-indigo-700">Thông tin sinh viên</p>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Trường đại học</label>
                      <input
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="VD: Đại học Bách Khoa TP.HCM"
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Năm tốt nghiệp</label>
                      <select
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200 bg-white"
                      >
                        <option value="">Chưa chọn</option>
                        {Array.from({ length: 9 }, (_, i) => 2024 + i).map((y) => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={openToInternship}
                          onChange={(e) => setOpenToInternship(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700">Sẵn sàng thực tập</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={partTimeOk}
                          onChange={(e) => setPartTimeOk(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-700">Có thể part-time</span>
                      </label>
                    </div>
                  </div>
                )}

                <TitlePillSelect value={desiredTitles} onChange={setDesiredTitles} />

                <SkillPillSelect value={skills} onChange={setSkills} />

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
