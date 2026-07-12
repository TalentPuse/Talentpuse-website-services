"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Aurora from "@/components/brand/Aurora";
import GlowCard from "@/components/brand/GlowCard";
import { Sparkles, ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Props = {
  headline: string;
  subtext: string;
};

const PROOF_POINTS = [
  { num: "10+", text: "Nguồn tuyển dụng IT/AI" },
  { num: "1,000+", text: "Việc làm cập nhật realtime" },
  { num: "24/7", text: "Alert qua Telegram, Zalo, Discord" },
];

const ROTATE_INTERVAL_MS = 3500;

/**
 * AuthBrandPanel — the dark left-hand panel on /signin and /signup.
 * Aurora glow + brand mark + one value-prop headline, with a small set of
 * proof points that auto-rotate (and can be tapped) underneath.
 */
export default function AuthBrandPanel({ headline, subtext }: Props) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActive((i) => (i + 1) % PROOF_POINTS.length),
      ROTATE_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden overflow-hidden border-r border-border bg-bg lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12">
      <Aurora />
      {/* Depth: vignette so text stays AA-legible over the aurora blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-bg/40 via-transparent to-bg/70"
      />

      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="ai-gradient ai-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
            <Sparkles {...ICON} size={20} className="text-white" />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight text-text">
            Talent<span className="ai-text">Puse</span>
          </span>
        </div>

        <div className="ai-gradient mt-8 mb-8 h-1 w-12 rounded-full" />

        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-md font-display text-3xl leading-tight font-semibold text-text"
        >
          {headline}
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
          className="mt-4 max-w-md leading-relaxed text-text-muted"
        >
          {subtext}
        </motion.p>
      </div>

      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <GlowCard
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center gap-3 px-4 py-3"
          >
            <span className="font-mono min-w-[68px] text-xl font-bold text-brand">
              {PROOF_POINTS[active].num}
            </span>
            <span className="text-sm text-text-muted">{PROOF_POINTS[active].text}</span>
          </GlowCard>
        </AnimatePresence>

        <div className="mt-3 flex items-center gap-1.5">
          {PROOF_POINTS.map((point, i) => (
            <button
              key={point.text}
              type="button"
              aria-label={`Xem: ${point.text}`}
              aria-current={i === active}
              onClick={() => setActive(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === active ? "w-6 bg-brand" : "w-1.5 bg-border hover:bg-text-muted"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
