"use client";

import { useState } from "react";
import { motion } from "framer-motion";

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

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_SKILLS.map((skill) => {
          const active = value.includes(skill);
          return (
            <motion.button
              key={skill}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => toggle(skill)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 border ${
                active
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
              }`}
            >
              {skill}
            </motion.button>
          );
        })}
      </div>
      {value.filter((s) => !PRESET_SKILLS.includes(s)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value
            .filter((s) => !PRESET_SKILLS.includes(s))
            .map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                {s}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== s))}
                  className="hover:text-brand-900"
                >
                  &times;
                </button>
              </span>
            ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), addCustom())
          }
          placeholder="Thêm kỹ năng khác..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200 transition"
        >
          Thêm
        </button>
      </div>
    </div>
  );
}
