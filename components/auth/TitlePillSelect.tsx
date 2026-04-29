"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const PRESET_TITLES = [
  "Data Engineer",
  "AI Engineer",
  "Backend Developer",
  "Frontend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Data Scientist",
  "Data Analyst",
  "ML Engineer",
  "Product Manager",
];

type Props = {
  value: string[];
  onChange: (titles: string[]) => void;
  label?: string;
};

export default function TitlePillSelect({
  value,
  onChange,
  label = "Vị trí mong muốn",
}: Props) {
  const [custom, setCustom] = useState("");

  function toggle(title: string) {
    onChange(
      value.includes(title)
        ? value.filter((t) => t !== title)
        : [...value, title],
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
        {PRESET_TITLES.map((title) => {
          const active = value.includes(title);
          return (
            <motion.button
              key={title}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => toggle(title)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 border ${
                active
                  ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
              }`}
            >
              {title}
            </motion.button>
          );
        })}
      </div>
      {value.filter((t) => !PRESET_TITLES.includes(t)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value
            .filter((t) => !PRESET_TITLES.includes(t))
            .map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700"
              >
                {t}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== t))}
                  className="hover:text-violet-900"
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
          placeholder="Thêm vị trí khác..."
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
