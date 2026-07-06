"use client";

import type { FormEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, Star, Banknote, GraduationCap, CalendarDays } from "lucide-react";

import GlowCard from "@/components/brand/GlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SkillPillSelect from "@/components/auth/SkillPillSelect";
import CityPillSelect from "@/components/auth/CityPillSelect";
import TitlePillSelect from "@/components/auth/TitlePillSelect";
import { User, Briefcase, MapPin, Building2, ICON } from "@/lib/icons";
import type { UserResponse } from "@/lib/api";

/** Radix Select forbids an empty-string item value; this sentinel stands in for "chưa chọn". */
const NONE = "__none__";

const EXPERIENCE_OPTIONS = [
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

const GRADUATION_YEARS = Array.from({ length: 9 }, (_, i) => 2024 + i);

type PersonalInfoFormProps = {
  user: UserResponse | null;
  editing: boolean;
  saving: boolean;
  fullName: string;
  onFullNameChange: (value: string) => void;
  desiredTitles: string[];
  onDesiredTitlesChange: (value: string[]) => void;
  skills: string[];
  onSkillsChange: (value: string[]) => void;
  salaryMin: string;
  onSalaryMinChange: (value: string) => void;
  salaryMax: string;
  onSalaryMaxChange: (value: string) => void;
  cities: string[];
  onCitiesChange: (value: string[]) => void;
  experienceLevel: string;
  onExperienceLevelChange: (value: string) => void;
  university: string;
  onUniversityChange: (value: string) => void;
  graduationYear: string;
  onGraduationYearChange: (value: string) => void;
  openToInternship: boolean;
  onOpenToInternshipChange: (value: boolean) => void;
  partTimeOk: boolean;
  onPartTimeOkChange: (value: boolean) => void;
  onSave: (e: FormEvent) => void;
  onCancel: () => void;
};

/**
 * PersonalInfoForm — renders both the "Profile" (`#profile`: identity + career
 * target) and "Preferences" (`#preferences`: salary/cities/student
 * availability) sub-nav sections. They're split conceptually, not by file,
 * because both read from and write to the same lifted state in the page
 * (shared with CvDropzone's auto-fill) and submit as a single form.
 */
export default function PersonalInfoForm({
  user, editing, saving,
  fullName, onFullNameChange,
  desiredTitles, onDesiredTitlesChange,
  skills, onSkillsChange,
  salaryMin, onSalaryMinChange,
  salaryMax, onSalaryMaxChange,
  cities, onCitiesChange,
  experienceLevel, onExperienceLevelChange,
  university, onUniversityChange,
  graduationYear, onGraduationYearChange,
  openToInternship, onOpenToInternshipChange,
  partTimeOk, onPartTimeOkChange,
  onSave, onCancel,
}: PersonalInfoFormProps) {
  const isStudent = experienceLevel === "student";

  return (
    <form onSubmit={onSave}>
      <section id="profile" className="scroll-mt-6">
        <SectionHeading icon={User} title="Hồ sơ cá nhân" subtitle="Thông tin giúp AI matching tìm việc phù hợp hơn" />
        <GlowCard className="mt-4 p-6">
          {editing ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input id="fullName" value={fullName} onChange={(e) => onFullNameChange(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="experienceLevel">Cấp độ kinh nghiệm</Label>
                <Select
                  value={experienceLevel || NONE}
                  onValueChange={(v) => onExperienceLevelChange(v === NONE ? "" : v)}
                >
                  <SelectTrigger id="experienceLevel" className="w-full">
                    <SelectValue placeholder="Chưa chọn" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Chưa chọn</SelectItem>
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <TitlePillSelect value={desiredTitles} onChange={onDesiredTitlesChange} />
              <SkillPillSelect value={skills} onChange={onSkillsChange} />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <InfoField icon={User} label="Họ và tên" value={user?.full_name || "—"} />
                <InfoField
                  icon={TrendingUp}
                  label="Cấp độ kinh nghiệm"
                  value={
                    user?.experience_level
                      ? EXPERIENCE_LABELS[user.experience_level] || user.experience_level
                      : "Chưa cập nhật"
                  }
                />
              </div>

              <InfoField
                icon={Briefcase}
                label="Vị trí mong muốn"
                value={
                  user?.desired_titles?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.desired_titles.map((t) => (
                        <span key={t} className="inline-block rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "Chưa cập nhật"
                  )
                }
              />

              <InfoField
                icon={Star}
                label="Kỹ năng"
                value={
                  user?.skills?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.skills.map((s) => (
                        <span key={s} className="inline-block rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-text">
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "Chưa cập nhật"
                  )
                }
              />
            </div>
          )}
        </GlowCard>
      </section>

      <section id="preferences" className="mt-10 scroll-mt-6">
        <SectionHeading icon={Building2} title="Ưu tiên công việc" subtitle="Mức lương, địa điểm và loại hình mong muốn" />
        <GlowCard className="mt-4 p-6">
          {editing ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="salaryMin">Lương tối thiểu (triệu VND)</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    value={salaryMin}
                    onChange={(e) => onSalaryMinChange(e.target.value)}
                    placeholder="VD: 15"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="salaryMax">Lương tối đa (triệu VND)</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    value={salaryMax}
                    onChange={(e) => onSalaryMaxChange(e.target.value)}
                    placeholder="VD: 30"
                  />
                </div>
              </div>

              <CityPillSelect value={cities} onChange={onCitiesChange} />

              {isStudent && (
                <div className="space-y-4 rounded-[var(--radius-md)] border border-info/30 bg-info/5 p-4">
                  <p className="text-sm font-semibold text-info">Thông tin sinh viên</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="university">Trường đại học</Label>
                    <Input
                      id="university"
                      value={university}
                      onChange={(e) => onUniversityChange(e.target.value)}
                      placeholder="VD: Đại học Bách Khoa TP.HCM"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="graduationYear">Năm tốt nghiệp</Label>
                    <Select
                      value={graduationYear || NONE}
                      onValueChange={(v) => onGraduationYearChange(v === NONE ? "" : v)}
                    >
                      <SelectTrigger id="graduationYear" className="w-full">
                        <SelectValue placeholder="Chưa chọn" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Chưa chọn</SelectItem>
                        {GRADUATION_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap items-center gap-6">
                    <Label className="cursor-pointer gap-2 font-normal">
                      <input
                        type="checkbox"
                        checked={openToInternship}
                        onChange={(e) => onOpenToInternshipChange(e.target.checked)}
                        className="h-4 w-4 rounded-sm border-border accent-brand-600 focus:ring-brand-500/40"
                      />
                      Sẵn sàng thực tập
                    </Label>
                    <Label className="cursor-pointer gap-2 font-normal">
                      <input
                        type="checkbox"
                        checked={partTimeOk}
                        onChange={(e) => onPartTimeOkChange(e.target.checked)}
                        className="h-4 w-4 rounded-sm border-border accent-brand-600 focus:ring-brand-500/40"
                      />
                      Có thể part-time
                    </Label>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={onCancel}>
                  Huỷ
                </Button>
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <InfoField
                  icon={Banknote}
                  label="Mức lương mong muốn"
                  value={
                    user?.desired_salary_min || user?.desired_salary_max
                      ? `${user.desired_salary_min ? user.desired_salary_min / 1_000_000 + "M" : "—"} — ${
                          user.desired_salary_max ? user.desired_salary_max / 1_000_000 + "M" : "—"
                        } VND/tháng`
                      : "Chưa cập nhật"
                  }
                />
                <InfoField
                  icon={MapPin}
                  label="Thành phố ưu tiên"
                  value={
                    user?.preferred_cities?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {user.preferred_cities.map((c) => (
                          <span key={c} className="inline-block rounded-lg bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "Chưa cập nhật"
                    )
                  }
                />
              </div>

              {user?.experience_level === "student" && (
                <div className="grid grid-cols-1 gap-6 border-t border-border pt-4 sm:grid-cols-3">
                  <InfoField icon={GraduationCap} label="Trường đại học" value={user.university || "Chưa cập nhật"} />
                  <InfoField
                    icon={CalendarDays}
                    label="Năm tốt nghiệp"
                    value={user.graduation_year ? String(user.graduation_year) : "Chưa cập nhật"}
                  />
                  <InfoField
                    icon={Building2}
                    label="Loại hình"
                    value={
                      [user.open_to_internship && "Thực tập", user.part_time_ok && "Part-time"]
                        .filter(Boolean)
                        .join(", ") || "Chưa cập nhật"
                    }
                  />
                </div>
              )}
            </div>
          )}
        </GlowCard>
      </section>
    </form>
  );
}

/* ── Section heading ── */

function SectionHeading({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <header className="flex items-center gap-2">
      <Icon {...ICON} className="text-text-muted" />
      <div>
        <h2 className="font-display text-lg font-bold text-text">{title}</h2>
        <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>
      </div>
    </header>
  );
}

/* ── Read-only info field ── */

function InfoField({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon size={16} strokeWidth={1.75} className="text-text-muted" />
        <dt className="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</dt>
      </div>
      <dd className="text-sm text-text">{value}</dd>
    </div>
  );
}
