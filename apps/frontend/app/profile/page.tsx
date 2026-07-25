"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

import { authApi, ApiError, CvExtractResponse } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ConnectionsSection from "@/components/profile/ConnectionsSection";
import PersonalInfoForm from "@/components/profile/PersonalInfoForm";
import CvDropzone from "@/components/profile/CvDropzone";
import { User, Settings, FileText, Bell, Send } from "@/lib/icons";
import { cn } from "@/lib/utils";

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

const SECTION_IDS = ["profile", "preferences", "cv", "alerts", "telegram"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const NAV_SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Hồ sơ", icon: User },
  { id: "preferences", label: "Ưu tiên", icon: Settings },
  { id: "cv", label: "CV", icon: FileText },
  { id: "alerts", label: "Thông báo", icon: Bell },
  { id: "telegram", label: "Telegram", icon: Send },
];

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

  // Bumping this remounts CvDropzone (fresh `key`), which is how its internal
  // idle→reading→analyzing→done→error state resets after a save/cancel —
  // the standard React "reset via key" pattern instead of lifting that state up.
  const [cvGeneration, setCvGeneration] = useState(0);

  const [activeSection, setActiveSection] = useState<SectionId>("profile");
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Scroll-spy for the sticky sub-nav: highlights whichever section is
  // crossing a band near the top of the scrollable `<main>` (AppShell owns
  // the actual scroll container, so we walk up to it via `.closest`).
  useEffect(() => {
    const root = contentRef.current?.closest("main") ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      { root, rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    SECTION_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  function handleNavigate(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCvParsed(d: CvExtractResponse["extracted"]) {
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
      setCvGeneration((g) => g + 1);
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      toast.error((err as ApiError).message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  function resetEdit() {
    setEditing(false);
    setCvGeneration((g) => g + 1);
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

  return (
    <div ref={contentRef} className="mx-auto max-w-6xl px-6 py-8">
      <ProfileHeader user={user} editing={editing} onEdit={() => setEditing(true)} />

      <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[200px_1fr]">
        <SettingsSubNav active={activeSection} onNavigate={handleNavigate} />

        <div className="min-w-0 space-y-10">
          <PersonalInfoForm
            user={user}
            editing={editing}
            saving={saving}
            fullName={fullName}
            onFullNameChange={setFullName}
            desiredTitles={desiredTitles}
            onDesiredTitlesChange={setDesiredTitles}
            skills={skills}
            onSkillsChange={setSkills}
            salaryMin={salaryMin}
            onSalaryMinChange={setSalaryMin}
            salaryMax={salaryMax}
            onSalaryMaxChange={setSalaryMax}
            cities={cities}
            onCitiesChange={setCities}
            experienceLevel={experienceLevel}
            onExperienceLevelChange={setExperienceLevel}
            university={university}
            onUniversityChange={setUniversity}
            graduationYear={graduationYear}
            onGraduationYearChange={setGraduationYear}
            openToInternship={openToInternship}
            onOpenToInternshipChange={setOpenToInternship}
            partTimeOk={partTimeOk}
            onPartTimeOkChange={setPartTimeOk}
            onSave={onSave}
            onCancel={resetEdit}
          />

          <CvDropzone
            key={cvGeneration}
            token={token}
            hasExistingCv={Boolean(user?.cv_file_url)}
            onParsed={handleCvParsed}
          />

          <ConnectionsSection token={token || undefined} />
        </div>
      </div>
    </div>
  );
}

/* ── Sticky settings sub-nav ── */

function SettingsSubNav({ active, onNavigate }: { active: SectionId; onNavigate: (id: string) => void }) {
  return (
    <nav aria-label="Điều hướng cài đặt hồ sơ" className="hidden lg:block">
      <ul className="sticky top-6 space-y-1 rounded-[var(--radius-lg)] border border-border bg-surface p-2">
        {NAV_SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(id);
                }}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  isActive ? "bg-brand-50 text-brand-700" : "text-text-muted hover:bg-surface-2 hover:text-text"
                )}
              >
                <Icon size={16} strokeWidth={1.75} />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
