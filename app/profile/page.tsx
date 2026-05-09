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
import TelegramLinkCard from "@/components/TelegramLinkCard";

type CvStep = "idle" | "reading" | "analyzing" | "done" | "error";

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

  // CV upload
  const [cvStep, setCvStep] = useState<CvStep>("idle");
  const [cvError, setCvError] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [extractedSummary, setExtractedSummary] = useState("");

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

    // Step 1: reading
    setCvStep("reading");
    await new Promise((r) => setTimeout(r, 500));

    // Step 2: analyzing
    setCvStep("analyzing");
    try {
      const res = await cvApi.upload(token, file);
      if (res.error) {
        setCvError(res.error);
        setCvStep("error");
        return;
      }
      const d = res.extracted;
      setEditing(true);
      if (d.skills?.length) setSkills(d.skills);
      if (d.desired_titles?.length) setDesiredTitles(d.desired_titles);
      if (d.preferred_cities?.length) setCities(d.preferred_cities);
      if (d.experience_level) setExperienceLevel(d.experience_level);
      if (d.salary_min_m) setSalaryMin(String(d.salary_min_m));
      if (d.salary_max_m) setSalaryMax(String(d.salary_max_m));
      if (d.education?.[0]?.university) setUniversity(d.education[0].university);
      if (d.education?.[0]?.graduation_year) setGraduationYear(String(d.education[0].graduation_year));

      // Build summary
      const parts: string[] = [];
      if (d.skills?.length) parts.push(`${d.skills.length} kỹ năng`);
      if (d.desired_titles?.length) parts.push(`${d.desired_titles.length} vị trí`);
      if (d.preferred_cities?.length) parts.push(`${d.preferred_cities.length} thành phố`);
      setExtractedSummary(parts.join(", "));

      setCvStep("done");
      toast.success("CV đã phân tích xong! Kiểm tra lại và nhấn Lưu.");
    } catch (err) {
      const apiErr = err as ApiError;
      setCvError(apiErr.message || "Không thể phân tích CV");
      setCvStep("error");
    }
  }

  const EXPERIENCE_OPTIONS = [
    { value: "", label: "Chưa chọn" },
    { value: "student", label: "Sinh viên" },
    { value: "fresher", label: "Fresher (< 1 năm)" },
    { value: "experienced", label: "Experienced (1-5 năm)" },
    { value: "manager", label: "Manager (> 5 năm)" },
  ];

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
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function resetCv() {
    setCvStep("idle");
    setCvError("");
    setCvFileName("");
    setExtractedSummary("");
  }

  const initials = user?.full_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("vi-VN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30">

      <main className="max-w-2xl mx-auto px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* User header */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xl font-bold shadow-md">
                {initials}
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{user?.full_name}</h1>
                <p className="text-sm text-slate-500">{user?.email}</p>
                {memberSince && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Thành viên từ {memberSince}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Telegram alert */}
          {token && <TelegramLinkCard token={token} />}

          {/* CV Upload */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Upload CV</h2>
              {user?.cv_file_url && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  CV đã tải
                </span>
              )}
            </div>

            {/* Idle — drag-drop zone */}
            {cvStep === "idle" && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const f = e.dataTransfer.files[0];
                  if (f) handleCvUpload(f);
                }}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                  dragOver
                    ? "border-brand-500 bg-brand-50/50 scale-[1.01]"
                    : "border-slate-200 hover:border-brand-400"
                }`}
              >
                <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-brand-50 flex items-center justify-center">
                  <svg className="w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-1">
                  Kéo thả file PDF vào đây
                </p>
                <p className="text-xs text-slate-400 mb-4">hoặc</p>
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
                <p className="text-xs text-slate-400 mt-3">
                  Hỗ trợ file PDF, tối đa 5MB
                </p>
              </div>
            )}

            {/* Processing — 3 step indicator */}
            {(cvStep === "reading" || cvStep === "analyzing" || cvStep === "done") && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-4">
                <ProcessStep
                  label="Đang đọc file PDF..."
                  doneLabel={`Đã đọc ${cvFileName}`}
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
                  label="Đang cập nhật hồ sơ..."
                  doneLabel={extractedSummary ? `Đã trích xuất: ${extractedSummary}` : "Đã cập nhật hồ sơ"}
                  active={cvStep === "done"}
                  done={false}
                />

                {cvStep === "done" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center"
                  >
                    CV đã phân tích xong! Kiểm tra các field bên dưới và nhấn <strong>Lưu</strong>.
                  </motion.div>
                )}
              </div>
            )}

            {/* Error */}
            {cvStep === "error" && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
                <p className="text-sm text-red-600 mb-3">{cvError}</p>
                <button
                  type="button"
                  onClick={resetCv}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition"
                >
                  Thử lại
                </button>
              </div>
            )}
          </div>

          {/* Profile form */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Hồ sơ</h2>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium transition"
                >
                  Chỉnh sửa
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={onSave} className="space-y-5">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Họ và tên
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                  />
                </div>

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
                      placeholder="Từ"
                      className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                    />
                    <input
                      type="number"
                      value={salaryMax}
                      onChange={(e) => setSalaryMax(e.target.value)}
                      placeholder="Đến"
                      className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <CityPillSelect value={cities} onChange={setCities} />

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-slate-700">
                    Cấp độ kinh nghiệm
                  </label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200 bg-white"
                  >
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {experienceLevel === "student" && (
                  <div className="space-y-4 p-4 rounded-lg bg-indigo-50/50 border border-indigo-100">
                    <p className="text-sm font-semibold text-indigo-700">Thông tin sinh viên</p>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Trường đại học
                      </label>
                      <input
                        value={university}
                        onChange={(e) => setUniversity(e.target.value)}
                        placeholder="VD: Đại học Bách Khoa TP.HCM"
                        className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        Năm tốt nghiệp
                      </label>
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
                        <span className="text-sm text-slate-700">Có thể làm part-time</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setCvStep("idle");
                      if (user) {
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
                    }}
                    className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Huỷ
                  </button>
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60 transition-colors"
                  >
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </motion.button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <ProfileField label="Họ và tên" value={user?.full_name || "—"} />
                <ProfileField
                  label="Vị trí mong muốn"
                  value={
                    user?.desired_titles && user.desired_titles.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {user.desired_titles.map((t) => (
                          <span
                            key={t}
                            className="inline-block rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "Chưa cập nhật"
                    )
                  }
                />
                <ProfileField
                  label="Kỹ năng"
                  value={
                    user?.skills && user.skills.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {user.skills.map((s) => (
                          <span
                            key={s}
                            className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "Chưa cập nhật"
                    )
                  }
                />
                <ProfileField
                  label="Mức lương mong muốn"
                  value={
                    user?.desired_salary_min || user?.desired_salary_max
                      ? `${user.desired_salary_min ? (user.desired_salary_min / 1_000_000) + "M" : "—"} — ${user.desired_salary_max ? (user.desired_salary_max / 1_000_000) + "M" : "—"} VND/tháng`
                      : "Chưa cập nhật"
                  }
                />
                <ProfileField
                  label="Thành phố ưu tiên"
                  value={
                    user?.preferred_cities && user.preferred_cities.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {user.preferred_cities.map((c) => (
                          <span
                            key={c}
                            className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "Chưa cập nhật"
                    )
                  }
                />
                <ProfileField
                  label="Cấp độ kinh nghiệm"
                  value={
                    user?.experience_level
                      ? { student: "Sinh viên", fresher: "Fresher (< 1 năm)", experienced: "Experienced (1-5 năm)", manager: "Manager (> 5 năm)" }[user.experience_level] || user.experience_level
                      : "Chưa cập nhật"
                  }
                />
                {user?.experience_level === "student" && (
                  <>
                    <ProfileField label="Trường đại học" value={user.university || "Chưa cập nhật"} />
                    <ProfileField label="Năm tốt nghiệp" value={user.graduation_year ? String(user.graduation_year) : "Chưa cập nhật"} />
                    <ProfileField
                      label="Loại hình làm việc"
                      value={[
                        user.open_to_internship && "Sẵn sàng thực tập",
                        user.part_time_ok && "Có thể part-time",
                      ].filter(Boolean).join(", ") || "Chưa cập nhật"}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </main>
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
            <div
              className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
              style={{
                animation: "cvProgress 45s linear forwards",
              }}
            />
            <style>{`
              @keyframes cvProgress {
                0% { width: 5%; }
                100% { width: 85%; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400 font-medium mb-1">
        {label}
      </dt>
      <dd className="text-sm text-slate-900">
        {typeof value === "string" ? value : value}
      </dd>
    </div>
  );
}
