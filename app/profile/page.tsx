"use client";

import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";

import { authApi, ApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Navbar from "@/components/dashboard/Navbar";
import SkillPillSelect from "@/components/auth/SkillPillSelect";
import CityPillSelect from "@/components/auth/CityPillSelect";
import TitlePillSelect from "@/components/auth/TitlePillSelect";
import TelegramLinkCard from "@/components/TelegramLinkCard";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

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
      });
      await refreshUser();
      setEditing(false);
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
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
      <Navbar />

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

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      if (user) {
                        setFullName(user.full_name);
                        setDesiredTitles(user.desired_titles || []);
                        setSkills(user.skills);
                        setSalaryMin(user.desired_salary_min ? String(user.desired_salary_min / 1_000_000) : "");
                        setSalaryMax(user.desired_salary_max ? String(user.desired_salary_max / 1_000_000) : "");
                        setCities(user.preferred_cities);
                        setExperienceLevel(user.experience_level || "");
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
              </div>
            )}
          </div>
        </motion.div>
      </main>
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
