"use client";

import { useState } from "react";
import { motion } from "framer-motion";

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

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="flex flex-wrap gap-2">
        {PRESET_CITIES.map((city) => {
          const active = value.includes(city);
          return (
            <motion.button
              key={city}
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => toggle(city)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200 border ${
                active
                  ? "bg-brand-600 text-white border-brand-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:border-brand-300"
              }`}
            >
              {city}
            </motion.button>
          );
        })}
      </div>
      {value.filter((c) => !PRESET_CITIES.includes(c)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value
            .filter((c) => !PRESET_CITIES.includes(c))
            .map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
              >
                {c}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== c))}
                  className="hover:text-emerald-900"
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
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())}
          placeholder="Thêm thành phố khác..."
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-hidden focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-200"
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
