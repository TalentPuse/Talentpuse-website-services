"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

import { Sparkles } from "@/lib/icons";
import type { Lang, LandingCopy } from "@/lib/landing-i18n";
import { DEMO_TRACKED_APPS, type TrackedStatus } from "@/lib/landing-data";

type Props = { t: LandingCopy; lang: Lang };

const STATUS_STYLE: Record<TrackedStatus, string> = {
  applied: "bg-blue-50 text-blue-700",
  interviewing: "bg-amber-50 text-amber-700",
  offer: "bg-emerald-50 text-emerald-700",
};

/**
 * Hero showcase: a mock "application board" with an AI-insight strip on top —
 * positions the product as an AI-powered manager of the jobs you've applied to.
 * Fully scripted from static DEMO_TRACKED_APPS (no network). The insight line is
 * derived from the same rows so counts always match.
 */
export default function HeroAiDemo({ t }: Props) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-60px" });

  const total = DEMO_TRACKED_APPS.length;
  const followups = DEMO_TRACKED_APPS.filter((a) => a.needsFollowUp).length;
  const interviews = DEMO_TRACKED_APPS.filter((a) => a.status === "interviewing").length;
  const insight = t.heroDemo.insight
    .replace("{total}", String(total))
    .replace("{followups}", String(followups))
    .replace("{interviews}", String(interviews));

  // Type the AI insight out once the card scrolls into view.
  const [insightLen, setInsightLen] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setInsightLen(insight.length);
      return;
    }
    setInsightLen(0);
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      setInsightLen(i);
      if (i < insight.length) timer = setTimeout(tick, 18);
    };
    timer = setTimeout(tick, 700);
    return () => clearTimeout(timer);
  }, [inView, reduce, insight]);

  return (
    <div ref={rootRef} className="relative w-full">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(420px circle at 60% 15%, color-mix(in oklch, var(--color-brand-600) 12%, transparent), transparent 70%)",
        }}
      />

      <div className="ai-glow overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm backdrop-blur-xl transition-shadow hover:shadow-lg hover:shadow-brand-900/5">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="ai-gradient grid h-6 w-6 place-items-center rounded-md">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </span>
          <span className="text-sm font-medium text-text">{t.heroDemo.title}</span>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500 motion-safe:animate-pulse" />
            {t.heroDemo.aiLabel}
          </span>
        </div>

        {/* AI insight strip */}
        <div className="flex gap-2 border-b border-border bg-surface-2/60 px-4 py-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} />
          <p className="min-h-[2.5rem] text-sm leading-relaxed text-text">
            {insight.slice(0, insightLen)}
            {!reduce && inView && insightLen < insight.length && <span className="tp-caret" />}
          </p>
        </div>

        {/* application rows */}
        <ul className="divide-y divide-border">
          {DEMO_TRACKED_APPS.map((app, i) => (
            <motion.li
              key={app.company}
              initial={reduce ? false : { opacity: 0, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: 0.1 + i * 0.12, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-sm font-semibold text-text-muted">
                {app.company.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text">{app.role}</p>
                <p className="truncate text-xs text-text-muted">{app.company}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[app.status]}`}
                >
                  {t.heroDemo.statuses[app.status]}
                </span>
                {app.needsFollowUp && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600">
                    <span className="h-1 w-1 rounded-full bg-amber-500" />
                    {t.heroDemo.followUp}
                  </span>
                )}
              </div>
            </motion.li>
          ))}
        </ul>

        <p className="px-4 py-2.5 text-center text-xs text-text-muted/70">{t.heroDemo.caption}</p>
      </div>
    </div>
  );
}
