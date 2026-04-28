"use client";

import { useState, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  value: string[];
  onChange: (skills: string[]) => void;
  label?: string;
};

export default function SkillTagInput({ value, onChange, label = "Kỹ năng" }: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    }
    if (e.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 p-2.5 focus-within:ring-2 focus-within:ring-brand-500/30 focus-within:border-brand-500 transition-all duration-200">
        <AnimatePresence>
          {value.map((s) => (
            <motion.span
              key={s}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
            >
              {s}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== s))}
                className="hover:text-brand-900 ml-0.5"
              >
                &times;
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={value.length === 0 ? "VD: Python, React, Docker..." : ""}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />
      </div>
      <p className="text-xs text-slate-400">Nhấn Enter hoặc dấu phẩy để thêm</p>
    </div>
  );
}
