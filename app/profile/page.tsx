"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { authApi, cvApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import SkillPillSelect from "@/components/auth/SkillPillSelect";
import CityPillSelect from "@/components/auth/CityPillSelect";
import TitlePillSelect from "@/components/auth/TitlePillSelect";
import ConnectionCard from "@/components/ConnectionCard";

type CvStep = "idle" | "reading" | "analyzing" | "done" | "error";

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

/* ── Channel icons ── */

const TG_ICON = (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const ZALO_ICON = (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M12.49 10.272c-.082 0-.16.016-.236.042a2.922 2.922 0 0 1-.872.128 2.922 2.922 0 0 1-.872-.128.803.803 0 0 0-.236-.042.8.8 0 0 0-.8.8c0 .344.224.64.536.752a4.52 4.52 0 0 0 1.372.208 4.52 4.52 0 0 0 1.372-.208.8.8 0 0 0 .536-.752.8.8 0 0 0-.8-.8zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.6 14.4c0 2.208-2.512 4-5.6 4s-5.6-1.792-5.6-4v-.2c0-2.208 2.512-4 5.6-4s5.6 1.792 5.6 4v.2z" />
  </svg>
);

const DISCORD_ICON = (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
  </svg>
);

const EXPERIENCE_OPTIONS = [
  { value: "", label: "Chưa chọn" },
  { value: "student", label: "Sinh viên" },
  { value: "fresher", label: "Fresher (< 1 năm)" },
  { value: "experienced", label: "Experienced (1-5 năm)" },
  { value: "manager", label: "Manager (> 5 năm)" },
];

const EXPERIENCE_LABELS: Record<string, string> = {
  student: "Sinh viên",
  fresher: "Fresher (< 1 năm)",
  experienced: "Experienced (1-5 năm)",
  manager: "Manager (> 5 năm)",
};

// Backend chỉ chấp nhận 4 giá trị này (Literal). Map các biến thể LLM hay trả về
// để tránh PUT /me trả 422 làm hỏng nút Lưu.
const VALID_EXPERIENCE = new Set(["student", "fresher", "experienced", "manager"]);
const EXPERIENCE_ALIASES: Record<string, string> = {
  intern: "student", student: "student",
  fresher: "fresher", junior: "fresher", entry: "fresher", "entry-level": "fresher", "entry level": "fresher",
  mid: "experienced", "mid-level": "experienced", experienced: "experienced", senior: "experienced",
  lead: "manager", manager: "manager", director: "manager",
};

function normalizeExperience(v: unknown): string {
  if (typeof v !== "string") return "";
  const key = v.trim().toLowerCase();
  return EXPERIENCE_ALIASES[key] ?? (VALID_EXPERIENCE.has(key) ? key : "");
}

// LLM nên trả lương theo triệu VND/tháng. Nếu nó trả VND tuyệt đối (vd 20000000),
// quy về triệu; loại giá trị vô lý.
function normalizeSalaryM(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = n >= 1000 ? n / 1_000_000 : n;
  if (m <= 0 || m > 1000) return "";
  return String(Math.round(m * 10) / 10);
}

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <ProfileContent />
    </DashboardLayout>
  );
}

function ProfileContent() {
  const { user, token, refreshUser } = useAuth();

  const [fullName, setFullName] = useState("");
  const [desiredTitles, setDesiredTitles] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [cities, setCities] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState("");
  const [university, setUniversity] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [openToInternship, setOpenToInternship] = useState(false);
  const [partTimeOk, setPartTimeOk] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cvStep, setCvStep] = useState<CvStep>("idle");
  const [cvError, setCvError] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState("");

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name);
    setDesiredTitles(user.desired_titles || []);
    setSkills(user.skills);
    setSalaryMin(user.desired_salary_min ? String(user.desired_salary_min / 1_000_000) : "");
    setSalaryMax(user.desired_salary_max ? String(user.desired_salary_max / 1_000_000) : "");
    setCities(user.preferred_cities);
    setExperienceLevel(user.experience_level || "");
    setUniversity(user.university || "");
    setGraduationYear(user.graduation_year ? String(user.graduation_year) : "");
    setOpenToInternship(user.open_to_internship);
    setPartTimeOk(user.part_time_ok);
  }, [user]);

  async function handleCvUpload(file: File) {
    if (!token) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setCvError("Chỉ hỗ trợ file PDF");
      setCvStep("error");
      return;
    }
    setCvFileName(file.name);
    setCvError("");
    setExtractedSummary("");
    setCvStep("reading");
    await new Promise((r) => setTimeout(r, 500));
    setCvStep("analyzing");
    try {
      const res = await cvApi.upload(token, file);
      if (res.error) { setCvError(res.error); setCvStep("error"); return; }
      const d = res.extracted;
      setEditing(true);
      if (d.skills?.length) setSkills(d.skills);
      if (d.desired_titles?.length) setDesiredTitles(d.desired_titles);
      if (d.preferred_cities?.length) setCities(d.preferred_cities);
      const exp = normalizeExperience(d.experience_level);
      if (exp) setExperienceLevel(exp);
      const smin = normalizeSalaryM(d.salary_min_m);
      if (smin) setSalaryMin(smin);
      const smax = normalizeSalaryM(d.salary_max_m);
      if (smax) setSalaryMax(smax);
      if (d.education?.[0]?.university) setUniversity(d.education[0].university);
      if (d.education?.[0]?.graduation_year) setGraduationYear(String(d.education[0].graduation_year));
      const parts: string[] = [];
      if (d.skills?.length) parts.push(`${d.skills.length} kỹ năng`);
      if (d.desired_titles?.length) parts.push(`${d.desired_titles.length} vị trí`);
      if (d.preferred_cities?.length) parts.push(`${d.preferred_cities.length} thành phố`);
      setExtractedSummary(parts.join(", "));
      setCvStep("done");
      toast.success("CV đã phân tích xong! Kiểm tra lại và nhấn Lưu.");
    } catch (err) {
      setCvError((err as ApiError).message || "Không thể phân tích CV");
      setCvStep("error");
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await authApi.updateMe(token, {
        full_name: fullName,
        desired_titles: desiredTitles,
        skills,
        desired_salary_min: salaryMin ? Number(salaryMin) * 1_000_000 : null,
        desired_salary_max: salaryMax ? Number(salaryMax) * 1_000_000 : null,
        preferred_cities: cities,
        experience_level: experienceLevel || null,
        university: university || null,
        graduation_year: graduationYear ? Number(graduationYear) : null,
        open_to_internship: openToInternship,
        part_time_ok: partTimeOk,
      });
      await refreshUser();
      setEditing(false);
      setCvStep("idle");
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      toast.error((err as ApiError).message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function resetEdit() {
    setEditing(false);
    setCvStep("idle");
    if (!user) return;
    setFullName(user.full_name);
    setDesiredTitles(user.desired_titles || []);
    setSkills(user.skills);
    setSalaryMin(user.desired_salary_min ? String(user.desired_salary_min / 1_000_000) : "");
    setSalaryMax(user.desired_salary_max ? String(user.desired_salary_max / 1_000_000) : "");
    setCities(user.preferred_cities);
    setExperienceLevel(user.experience_level || "");
    setUniversity(user.university || "");
    setGraduationYear(user.graduation_year ? String(user.graduation_year) : "");
    setOpenToInternship(user.open_to_internship);
    setPartTimeOk(user.part_time_ok);
  }

  const initials = user?.full_name?.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric" })
    : "";

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-brand-50/30">
      <main className="max-w-4xl mx-auto px-6 py-8">
        <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-8">

          {/* ── Hero Banner ── */}
          <motion.section variants={fadeUp}>
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-800 p-8 text-white shadow-lg">
              {/* Decorative circles */}
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

              <div className="relative flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-2xl font-bold shadow-inner border border-white/20">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-bold">{user?.full_name || "..."}</h1>
                  <p className="text-brand-200 text-sm mt-0.5">{user?.email}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {memberSince && (
                      <span className="text-xs text-brand-300">Thành viên từ {memberSince}</span>
                    )}
                    <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-xs font-semibold capitalize">
                      {user?.subscription_tier || "Free"}
                    </span>
                  </div>
                </div>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="shrink-0 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-xs border border-white/20 px-5 py-2.5 text-sm font-semibold transition-colors"
                  >
                    Chỉnh sửa hồ sơ
                  </button>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── Connections ── */}
          <motion.section variants={fadeUp}>
            <SectionHeader
              title="Kết nối thông báo"
              subtitle="Quản lý các kênh nhận alert việc làm"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              <ConnectionCard
                icon={TG_ICON}
                name="Telegram"
                description="Nhận alert qua Telegram"
                color="sky"
                bgColor="sky"
                token={token || undefined}
              />
              <ConnectionCard
                icon={ZALO_ICON}
                name="Zalo"
                description="Nhận alert qua Zalo OA"
                color="blue"
                bgColor="blue"
                comingSoon
              />
              <ConnectionCard
                icon={DISCORD_ICON}
                name="Discord"
                description="Nhận alert qua Discord Bot"
                color="indigo"
                bgColor="indigo"
                comingSoon
              />
            </div>
          </motion.section>

          {/* ── Profile Info + Skills ── */}
          <motion.section variants={fadeUp}>
            <SectionHeader
              title="Hồ sơ cá nhân"
              subtitle="Thông tin giúp AI matching tìm việc phù hợp hơn"
              action={!editing ? undefined : undefined}
            />
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 mt-4">
              {editing ? (
                <form onSubmit={onSave} className="space-y-5">
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Họ và tên</label>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                    />
                  </div>

                  <TitlePillSelect value={desiredTitles} onChange={setDesiredTitles} />
                  <SkillPillSelect value={skills} onChange={setSkills} />
                  <CityPillSelect value={cities} onChange={setCities} />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Lương tối thiểu (triệu VND)</label>
                      <input
                        type="number"
                        value={salaryMin}
                        onChange={(e) => setSalaryMin(e.target.value)}
                        placeholder="VD: 15"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">Lương tối đa (triệu VND)</label>
                      <input
                        type="number"
                        value={salaryMax}
                        onChange={(e) => setSalaryMax(e.target.value)}
                        placeholder="VD: 30"
                        className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-slate-700">Cấp độ kinh nghiệm</label>
                    <select
                      value={experienceLevel}
                      onChange={(e) => setExperienceLevel(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all bg-white"
                    >
                      {EXPERIENCE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {experienceLevel === "student" && (
                    <div className="space-y-4 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100">
                      <p className="text-sm font-semibold text-indigo-700">Thông tin sinh viên</p>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">Trường đại học</label>
                        <input
                          value={university}
                          onChange={(e) => setUniversity(e.target.value)}
                          placeholder="VD: Đại học Bách Khoa TP.HCM"
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-sm font-medium text-slate-700">Năm tốt nghiệp</label>
                        <select
                          value={graduationYear}
                          onChange={(e) => setGraduationYear(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all bg-white"
                        >
                          <option value="">Chưa chọn</option>
                          {Array.from({ length: 9 }, (_, i) => 2024 + i).map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={openToInternship} onChange={(e) => setOpenToInternship(e.target.checked)} className="w-4 h-4 rounded-sm border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-slate-700">Sẵn sàng thực tập</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={partTimeOk} onChange={(e) => setPartTimeOk(e.target.checked)} className="w-4 h-4 rounded-sm border-slate-300 text-brand-600 focus:ring-brand-500" />
                          <span className="text-sm text-slate-700">Có thể part-time</span>
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={resetEdit}
                      className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                    >
                      Huỷ
                    </button>
                    <motion.button
                      type="submit"
                      disabled={saving}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex-1 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-60 transition-colors"
                    >
                      {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </motion.button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6">
                  {/* Row 1: Name + Experience */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InfoField icon="user" label="Họ và tên" value={user?.full_name || "—"} />
                    <InfoField icon="level" label="Cấp độ kinh nghiệm" value={user?.experience_level ? EXPERIENCE_LABELS[user.experience_level] || user.experience_level : "Chưa cập nhật"} />
                  </div>

                  {/* Desired titles */}
                  <InfoField
                    icon="title"
                    label="Vị trí mong muốn"
                    value={
                      user?.desired_titles?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.desired_titles.map(t => (
                            <span key={t} className="inline-block rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">{t}</span>
                          ))}
                        </div>
                      ) : "Chưa cập nhật"
                    }
                  />

                  {/* Skills */}
                  <InfoField
                    icon="skill"
                    label="Kỹ năng"
                    value={
                      user?.skills?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {user.skills.map(s => (
                            <span key={s} className="inline-block rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">{s}</span>
                          ))}
                        </div>
                      ) : "Chưa cập nhật"
                    }
                  />

                  {/* Salary + Cities row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <InfoField
                      icon="salary"
                      label="Mức lương mong muốn"
                      value={
                        user?.desired_salary_min || user?.desired_salary_max
                          ? `${user.desired_salary_min ? (user.desired_salary_min / 1_000_000) + "M" : "—"} — ${user.desired_salary_max ? (user.desired_salary_max / 1_000_000) + "M" : "—"} VND/tháng`
                          : "Chưa cập nhật"
                      }
                    />
                    <InfoField
                      icon="city"
                      label="Thành phố ưu tiên"
                      value={
                        user?.preferred_cities?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {user.preferred_cities.map(c => (
                              <span key={c} className="inline-block rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">{c}</span>
                            ))}
                          </div>
                        ) : "Chưa cập nhật"
                      }
                    />
                  </div>

                  {/* Student fields */}
                  {user?.experience_level === "student" && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2 border-t border-slate-100">
                      <InfoField icon="school" label="Trường đại học" value={user.university || "Chưa cập nhật"} />
                      <InfoField icon="year" label="Năm tốt nghiệp" value={user.graduation_year ? String(user.graduation_year) : "Chưa cập nhật"} />
                      <InfoField
                        icon="work"
                        label="Loại hình"
                        value={[user.open_to_internship && "Thực tập", user.part_time_ok && "Part-time"].filter(Boolean).join(", ") || "Chưa cập nhật"}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* ── CV Upload ── */}
          <motion.section variants={fadeUp}>
            <SectionHeader
              title="CV & Hồ sơ ứng tuyển"
              subtitle="Upload CV để AI tự động trích xuất thông tin"
            />
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 text-sm">File CV</h3>
                    {user?.cv_file_url && (
                      <span className="text-xs text-emerald-600">CV đã được tải lên</span>
                    )}
                  </div>
                </div>
                {user?.cv_file_url && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Đã tải
                  </span>
                )}
              </div>

              {cvStep === "idle" && (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleCvUpload(f); }}
                  className={`rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                    dragOver ? "border-brand-500 bg-brand-50/50 scale-[1.01]" : "border-slate-200 hover:border-brand-400"
                  }`}
                >
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-50 flex items-center justify-center">
                    <svg className="w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">Kéo thả file PDF vào đây</p>
                  <p className="text-xs text-slate-400 mb-4">hoặc</p>
                  <label className="inline-block cursor-pointer rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
                    Chọn file PDF
                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCvUpload(f); }} />
                  </label>
                  <p className="text-xs text-slate-400 mt-3">Hỗ trợ file PDF, tối đa 5MB</p>
                </div>
              )}

              {(cvStep === "reading" || cvStep === "analyzing" || cvStep === "done") && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                  <ProcessStep label="Đang đọc file PDF..." doneLabel={`Đã đọc ${cvFileName}`} active={cvStep === "reading"} done={cvStep === "analyzing" || cvStep === "done"} />
                  <ProcessStep label="Đang phân tích CV bằng AI..." doneLabel="Phân tích CV hoàn tất" active={cvStep === "analyzing"} done={cvStep === "done"} showProgress={cvStep === "analyzing"} />
                  <ProcessStep label="Đang cập nhật hồ sơ..." doneLabel={extractedSummary ? `Đã trích xuất: ${extractedSummary}` : "Đã cập nhật hồ sơ"} active={cvStep === "done"} done={false} />
                  {cvStep === "done" && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center">
                      CV đã phân tích xong! Kiểm tra các field bên dưới và nhấn <strong>Lưu</strong>.
                    </motion.div>
                  )}
                </div>
              )}

              {cvStep === "error" && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
                  <p className="text-sm text-red-600 mb-3">{cvError}</p>
                  <button type="button" onClick={() => { setCvStep("idle"); setCvError(""); setCvFileName(""); setExtractedSummary(""); }} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition">
                    Thử lại
                  </button>
                </div>
              )}
            </div>
          </motion.section>

        </motion.div>
      </main>
    </div>
  );
}

/* ── Section Header ── */

function SectionHeader({ title, subtitle }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

/* ── Info Field (read-only) ── */

const FIELD_ICONS: Record<string, React.ReactNode> = {
  user: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>,
  level: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
  title: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>,
  skill: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>,
  salary: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  city: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>,
  school: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" /></svg>,
  year: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>,
  work: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>,
};

function InfoField({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-slate-400">{FIELD_ICONS[icon]}</span>
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      </div>
      <dd className="text-sm text-slate-900">{typeof value === "string" ? value : value}</dd>
    </div>
  );
}

/* ── CV Process Step ── */

function ProcessStep({ label, doneLabel, active, done, showProgress }: {
  label: string; doneLabel: string; active: boolean; done: boolean; showProgress?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        {done ? (
          <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        ) : active ? (
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-slate-200" />
        )}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? "text-emerald-600" : active ? "text-slate-800" : "text-slate-400"}`}>
          {done ? doneLabel : label}
        </p>
        {showProgress && (
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-linear-to-r from-brand-400 to-brand-600 rounded-full" style={{ animation: "cvProgress 45s linear forwards" }} />
            <style>{`@keyframes cvProgress { 0% { width: 5%; } 100% { width: 85%; } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
}
