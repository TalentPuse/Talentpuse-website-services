"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

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

  const customTitles = value.filter((t) => !PRESET_TITLES.includes(t));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PRESET_TITLES.map((title) => {
          const active = value.includes(title);
          return (
            <motion.button
              key={title}
              type="button"
              whileTap={{ scale: 0.95 }}
              aria-pressed={active}
              onClick={() => toggle(title)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200",
                active
                  ? "border-brand-600 bg-brand-600 text-white shadow-xs"
                  : "border-border bg-surface-2 text-text-muted hover:border-brand-400 hover:text-text"
              )}
            >
              {title}
            </motion.button>
          );
        })}
      </div>
      {customTitles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customTitles.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning"
            >
              {t}
              <button
                type="button"
                aria-label={`Xóa ${t}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="rounded-full p-0.5 hover:bg-warning/20"
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
          placeholder="Thêm vị trí khác..."
          aria-label="Thêm vị trí khác"
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
