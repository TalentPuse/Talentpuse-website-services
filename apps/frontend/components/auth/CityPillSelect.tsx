"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

const PRESET_CITIES = ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Remote"];

type Props = {
  value: string[];
  onChange: (cities: string[]) => void;
  label?: string;
};

export default function CityPillSelect({
  value,
  onChange,
  label = "Thành phố ưu tiên",
}: Props) {
  const [custom, setCustom] = useState("");

  function toggle(city: string) {
    onChange(
      value.includes(city) ? value.filter((c) => c !== city) : [...value, city],
    );
  }

  function addCustom() {
    const trimmed = custom.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setCustom("");
  }

  const customCities = value.filter((c) => !PRESET_CITIES.includes(c));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PRESET_CITIES.map((city) => {
          const active = value.includes(city);
          return (
            <motion.button
              key={city}
              type="button"
              whileTap={{ scale: 0.95 }}
              aria-pressed={active}
              onClick={() => toggle(city)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-200",
                active
                  ? "border-brand-600 bg-brand-600 text-white shadow-xs"
                  : "border-border bg-surface-2 text-text-muted hover:border-brand-400 hover:text-text"
              )}
            >
              {city}
            </motion.button>
          );
        })}
      </div>
      {customCities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customCities.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success"
            >
              {c}
              <button
                type="button"
                aria-label={`Xóa ${c}`}
                onClick={() => onChange(value.filter((x) => x !== c))}
                className="rounded-full p-0.5 hover:bg-success/20"
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
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          placeholder="Thêm thành phố khác..."
          aria-label="Thêm thành phố khác"
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
