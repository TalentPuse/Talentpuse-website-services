"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Upload, PenLine, ChevronLeft } from "lucide-react";

import { authApi, cvApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { AI_HOME } from "@/lib/flags";
import AuthInput from "@/components/auth/AuthInput";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import SkillPillSelect from "@/components/auth/SkillPillSelect";
import CityPillSelect from "@/components/auth/CityPillSelect";
import TitlePillSelect from "@/components/auth/TitlePillSelect";
import Aurora from "@/components/brand/Aurora";
import GlowCard from "@/components/brand/GlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, FileText, CheckCircle2, AlertCircle, ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

/** Đích sau khi đăng ký xong — khớp đúng biểu thức mà /signin đang dùng,
 *  để hai đường đăng nhập và đăng ký không dẫn đi hai nơi khác nhau. */
const POST_AUTH_HOME = AI_HOME ? "/assistant" : "/dashboard";

type Step2Mode = "cv" | "manual";
type CvStep = "idle" | "reading" | "analyzing" | "done" | "error";

const NO_YEAR = "__none__";

export default function SignUpPage() {
  return <SignUpWizard />;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function SignUpWizard() {
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
  const [step2Mode, setStep2Mode] = useState<Step2Mode>("cv");
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
  const [cvStep, setCvStep] = useState<CvStep>("idle");
  const [cvError, setCvError] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function handleCvUpload(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setCvError("Chỉ hỗ trợ file PDF");
      setCvStep("error");
      return;
    }
    setCvFileName(file.name);
    setCvError("");
    setCvStep("reading");

    // Brief "reading" state then move to analyzing
    await new Promise((r) => setTimeout(r, 600));
    setCvStep("analyzing");

    try {
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
        setCvStep("error");
        return;
      }
      setCvStep("done");
      // Auto-login and redirect
      const user = await authApi.getMe(access_token);
      login(access_token, user);
      toast.success("CV đã được phân tích! Kiểm tra và cập nhật profile.");
      router.push("/profile");
    } catch (err) {
      const apiErr = err as ApiError;
      setCvError(apiErr.message || "Không thể phân tích CV");
      setCvStep("error");
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
    else if (!isValidEmail(email)) errs.email = "Email không hợp lệ";
    if (password.length < 8) errs.password = "Mật khẩu phải có ít nhất 8 ký tự";
    if (password !== confirm) errs.confirm = "Mật khẩu xác nhận không khớp";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function goStep2(e: FormEvent) {
    e.preventDefault();
    if (validateStep1()) {
      setStep2Mode("cv");
      setStep(2);
    }
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
      router.push(POST_AUTH_HOME);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  async function skipAndSubmit() {
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
      router.push(POST_AUTH_HOME);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  }

  function resetCv() {
    setCvStep("idle");
    setCvError("");
    setCvFileName("");
  }

  function onTabChange(value: string) {
    const mode = value as Step2Mode;
    setStep2Mode(mode);
    if (mode !== "cv") resetCv();
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <AuthBrandPanel
        headline="Tạo tài khoản để AI match job cho bạn"
        subtext="Thiết lập profile skills, mức lương mong muốn — AI sẽ alert ngay khi có việc phù hợp qua Telegram, Zalo, Discord."
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
            <div className="mb-6">
              <h1 className="font-display text-2xl font-semibold text-text">Đăng ký</h1>
              <p className="mt-1.5 text-sm text-text-muted">
                Đã có tài khoản?{" "}
                <a href="/signin" className="font-medium text-brand-400 hover:text-brand-300">
                  Đăng nhập
                </a>
              </p>
            </div>

            {/* Tokenized step progress */}
            <div className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "text-xs font-semibold tracking-wide uppercase",
                    step >= 1 ? "text-brand-400" : "text-text-muted"
                  )}
                >
                  Tài khoản
                </span>
                <div className="h-px flex-1 bg-border" />
                <span
                  className={cn(
                    "text-xs font-semibold tracking-wide uppercase",
                    step >= 2 ? "text-brand-400" : "text-text-muted"
                  )}
                >
                  Hồ sơ
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="ai-gradient h-full rounded-full"
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
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
              >
                <AlertCircle {...ICON} size={16} className="mt-0.5 shrink-0" />
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
                  noValidate
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

                  <Button type="submit" size="lg" className="w-full">
                    Tiếp tục
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="step2"
                  custom={2}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <Tabs value={step2Mode} onValueChange={onTabChange}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="cv" className="gap-1.5">
                        <FileText size={15} strokeWidth={1.75} />
                        Upload CV
                      </TabsTrigger>
                      <TabsTrigger value="manual" className="gap-1.5">
                        <PenLine size={15} strokeWidth={1.75} />
                        Điền tay
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="cv" className="mt-5 space-y-4">
                      {cvStep === "idle" && (
                        <div
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOver(true);
                          }}
                          onDragLeave={() => setDragOver(false)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOver(false);
                            const f = e.dataTransfer.files[0];
                            if (f) handleCvUpload(f);
                          }}
                          className={cn(
                            "rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
                            dragOver
                              ? "scale-[1.01] border-brand-500 bg-brand-500/10"
                              : "border-border hover:border-brand-400"
                          )}
                        >
                          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10">
                            <Upload size={26} strokeWidth={1.5} className="text-brand-400" />
                          </div>
                          <p className="mb-1 text-sm font-medium text-text">
                            Kéo thả file PDF vào đây
                          </p>
                          <p className="mb-4 text-xs text-text-muted">hoặc</p>
                          <label className="inline-block cursor-pointer rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
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
                          <p className="mt-3 text-xs text-text-muted">
                            Hỗ trợ file PDF, tối đa 5MB
                          </p>
                        </div>
                      )}

                      {(cvStep === "reading" || cvStep === "analyzing" || cvStep === "done") && (
                        <GlowCard className="space-y-4 p-6">
                          <ProcessStep
                            label="Đang đọc file PDF..."
                            doneLabel="Đã đọc file PDF"
                            active={cvStep === "reading"}
                            done={cvStep === "analyzing" || cvStep === "done"}
                          />
                          <ProcessStep
                            label="Đang phân tích CV bằng AI..."
                            doneLabel="Phân tích CV hoàn tất"
                            active={cvStep === "analyzing"}
                            done={cvStep === "done"}
                            showProgress={cvStep === "analyzing"}
                          />
                          <ProcessStep
                            label="Đang tạo tài khoản..."
                            doneLabel="Hoàn tất!"
                            active={cvStep === "done"}
                            done={false}
                          />

                          {cvStep === "done" && (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center text-sm font-medium text-success"
                            >
                              Đang chuyển hướng...
                            </motion.p>
                          )}
                        </GlowCard>
                      )}

                      {cvStep === "error" && (
                        <div className="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center">
                          <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-danger">
                            <AlertCircle {...ICON} size={16} />
                            {cvError}
                          </p>
                          <div className="flex justify-center gap-3">
                            <Button type="button" size="sm" onClick={resetCv}>
                              Thử lại
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                resetCv();
                                setStep2Mode("manual");
                              }}
                            >
                              Điền tay thay
                            </Button>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="manual" className="mt-5">
                      <form onSubmit={onSubmit} className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-text-muted">Cấp độ kinh nghiệm</Label>
                          <div className="flex flex-wrap gap-2">
                            {EXPERIENCE_OPTIONS.map((opt) => {
                              const active = experienceLevel === opt.value;
                              return (
                                <motion.button
                                  key={opt.value}
                                  type="button"
                                  whileTap={{ scale: 0.95 }}
                                  aria-pressed={active}
                                  onClick={() => setExperienceLevel(active ? "" : opt.value)}
                                  className={cn(
                                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200",
                                    active
                                      ? "border-brand-600 bg-brand-600 text-white shadow-xs"
                                      : "border-border bg-surface-2 text-text-muted hover:border-brand-400 hover:text-text"
                                  )}
                                >
                                  {opt.label}
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>

                        {experienceLevel === "student" && (
                          <div className="space-y-3 rounded-lg border border-info/25 bg-info/10 p-4">
                            <p className="text-sm font-semibold text-info">Thông tin sinh viên</p>
                            <div className="space-y-1.5">
                              <Label className="text-text-muted">Trường đại học</Label>
                              <Input
                                value={university}
                                onChange={(e) => setUniversity(e.target.value)}
                                placeholder="VD: Đại học Bách Khoa TP.HCM"
                                className="border-border bg-surface-2 text-text placeholder:text-text-muted/50 focus-visible:border-brand-400 focus-visible:ring-brand-500/30"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-text-muted">Năm tốt nghiệp</Label>
                              <Select
                                value={graduationYear || NO_YEAR}
                                onValueChange={(v) => setGraduationYear(v === NO_YEAR ? "" : v)}
                              >
                                <SelectTrigger className="w-full border-border bg-surface-2 text-text">
                                  <SelectValue placeholder="Chưa chọn" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={NO_YEAR}>Chưa chọn</SelectItem>
                                  {Array.from({ length: 9 }, (_, i) => 2024 + i).map((y) => (
                                    <SelectItem key={y} value={String(y)}>
                                      {y}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center gap-6">
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={openToInternship}
                                  onChange={(e) => setOpenToInternship(e.target.checked)}
                                  className="h-4 w-4 rounded-sm border-border accent-brand-600 focus:ring-brand-500/40"
                                />
                                <span className="text-sm text-text">Sẵn sàng thực tập</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={partTimeOk}
                                  onChange={(e) => setPartTimeOk(e.target.checked)}
                                  className="h-4 w-4 rounded-sm border-border accent-brand-600 focus:ring-brand-500/40"
                                />
                                <span className="text-sm text-text">Có thể part-time</span>
                              </label>
                            </div>
                          </div>
                        )}

                        <TitlePillSelect value={desiredTitles} onChange={setDesiredTitles} />
                        <SkillPillSelect value={skills} onChange={setSkills} />

                        <div className="space-y-1.5">
                          <Label className="text-text-muted">
                            Mức lương mong muốn (triệu VND/tháng)
                          </Label>
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              type="number"
                              value={salaryMin}
                              onChange={(e) => setSalaryMin(e.target.value)}
                              placeholder="Từ (VD: 20)"
                              className="border-border bg-surface-2 text-text placeholder:text-text-muted/50 focus-visible:border-brand-400 focus-visible:ring-brand-500/30"
                            />
                            <Input
                              type="number"
                              value={salaryMax}
                              onChange={(e) => setSalaryMax(e.target.value)}
                              placeholder="Đến (VD: 40)"
                              className="border-border bg-surface-2 text-text placeholder:text-text-muted/50 focus-visible:border-brand-400 focus-visible:ring-brand-500/30"
                            />
                          </div>
                        </div>

                        <CityPillSelect value={cities} onChange={setCities} />

                        <Button type="submit" disabled={loading} size="lg" className="w-full">
                          {loading ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                              Đang tạo tài khoản...
                            </span>
                          ) : (
                            "Hoàn tất đăng ký"
                          )}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
                    >
                      <ChevronLeft size={14} strokeWidth={2} />
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={skipAndSubmit}
                      disabled={loading}
                      className="text-xs text-text-muted transition-colors hover:text-text disabled:opacity-50"
                    >
                      Bỏ qua, tôi sẽ cập nhật sau
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

/* ── Reusable Process Step Component ── */

function ProcessStep({
  label,
  doneLabel,
  active,
  done,
  showProgress,
}: {
  label: string;
  doneLabel: string;
  active: boolean;
  done: boolean;
  showProgress?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">
        {done ? (
          <CheckCircle2 size={20} strokeWidth={2} className="text-success" />
        ) : active ? (
          <Loader2 size={20} strokeWidth={2} className="animate-spin text-brand-400" />
        ) : (
          <div className="h-5 w-5 rounded-full border-2 border-border" />
        )}
      </div>
      <div className="flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            done ? "text-success" : active ? "text-text" : "text-text-muted"
          )}
        >
          {done ? doneLabel : label}
        </p>
        {showProgress && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="ai-gradient h-full rounded-full"
              initial={{ width: "5%" }}
              animate={{ width: "85%" }}
              transition={{ duration: 40, ease: "linear" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
