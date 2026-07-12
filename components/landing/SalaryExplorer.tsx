"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { BadgeDollarSign } from "@/lib/icons";
import type { Lang, LandingCopy } from "@/lib/landing-i18n";
import { CITIES, LEVELS, SALARY_MATRIX, SALARY_MAX, type City, type Level } from "@/lib/landing-data";

type Props = { t: LandingCopy; lang: Lang };

export default function SalaryExplorer({ t }: Props) {
  const reduce = useReducedMotion();
  const copy = t.dataStory.salaryExplorer;
  const [level, setLevel] = useState<Level>("fresher");
  const [city, setCity] = useState<City>("hcm");

  const [p25, p50, p75] = SALARY_MATRIX[level][city];
  const left = (p25 / SALARY_MAX) * 100;
  const width = ((p75 - p25) / SALARY_MAX) * 100;
  const mid = (p50 / SALARY_MAX) * 100;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 300, damping: 30 };

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <span className="ai-gradient grid h-7 w-7 place-items-center rounded-lg">
          <BadgeDollarSign className="h-4 w-4 text-white" strokeWidth={2} />
        </span>
        <h3 className="font-display text-base font-semibold text-text">{copy.title}</h3>
      </div>

      <PillGroup
        label={copy.levelLabel}
        options={LEVELS}
        value={level}
        onChange={setLevel}
        render={(l) => copy.levels[l]}
      />
      <div className="h-3" />
      <PillGroup
        label={copy.cityLabel}
        options={CITIES}
        value={city}
        onChange={setCity}
        render={(c) => copy.cities[c]}
      />

      {/* range bar */}
      <div className="mt-6">
        <div className="relative h-3 w-full rounded-full bg-surface-2">
          <motion.div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-brand-600 to-brand-400"
            animate={{ left: `${left}%`, width: `${width}%` }}
            transition={spring}
          />
          <motion.div
            className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-text shadow"
            animate={{ left: `calc(${mid}% - 2px)` }}
            transition={spring}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-xs text-text-muted">
          <span>{p25}tr</span>
          <span>{p75}tr</span>
        </div>
      </div>

      {/* median headline */}
      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-sm text-text-muted">{copy.medianLabel}:</span>
        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={`${level}-${city}`}
              initial={reduce ? false : { y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduce ? undefined : { y: -14, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="inline-block font-display text-3xl font-bold text-brand-600 tabular-nums"
            >
              {p50}
            </motion.span>
          </AnimatePresence>
        </div>
        <span className="text-sm text-text-muted">{copy.unit}</span>
      </div>
    </div>
  );
}

function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isActive = opt === value;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              aria-pressed={isActive}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                isActive
                  ? "border-brand-500/50 bg-brand-500/15 text-brand-700"
                  : "border-border text-text-muted hover:border-brand-500/30 hover:text-text"
              }`}
            >
              {render(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
