"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

const PRESET_SKILLS = [
  "Python",
  "SQL",
  "JavaScript",
  "Power BI",
  "Excel",
  "Data Analysis",
  "AI",
  "Deep Learning",
  "LLM",
  "ETL",
  "Data Modeling",
  "AWS",
  "Docker",
  "React",
  "Data Science",
];

type Props = {
  value: string[];
  onChange: (skills: string[]) => void;
  label?: string;
};

export default function SkillPillSelect({
  value,
  onChange,
  label = "Kỹ năng",
}: Props) {
  const [custom, setCustom] = useState("");

  function toggle(skill: string) {
    onChange(
      value.includes(skill)
        ? value.filter((s) => s !== skill)
        : [...value, skill],
    );
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setCustom("");
  }

  const customSkills = value.filter((s) => !PRESET_SKILLS.includes(s));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PRESET_SKILLS.map((skill) => {
          const active = value.includes(skill);
          return (
            <motion.button
              key={skill}
              type="button"
              whileTap={{ scale: 0.95 }}
              aria-pressed={active}
              onClick={() => toggle(skill)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200",
                active
                  ? "border-brand-600 bg-brand-600 text-white shadow-xs"
                  : "border-border bg-surface-2 text-text-muted hover:border-brand-400 hover:text-text"
              )}
            >
              {skill}
            </motion.button>
          );
        })}
      </div>
      {customSkills.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customSkills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {s}
              <button
                type="button"
                aria-label={`Xóa ${s}`}
                onClick={() => onChange(value.filter((x) => x !== s))}
                className="rounded-full p-0.5 hover:bg-brand-600/20"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), addCustom())
          }
          placeholder="Thêm kỹ năng khác..."
          aria-label="Thêm kỹ năng khác"
          className="h-9 flex-1 border-border bg-surface-2 text-sm text-text placeholder:text-text-muted/50 focus-visible:border-brand-400 focus-visible:ring-brand-500/30"
        />
        <Button type="button" onClick={addCustom} variant="secondary" size="sm">
          <Plus {...ICON} size={16} />
          Thêm
        </Button>
      </div>
    </div>
  );
}
