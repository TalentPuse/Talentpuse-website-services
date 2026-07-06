"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import GlowCard from "@/components/brand/GlowCard";

const miniSkills = [
  { name: "Python", pct: 92 },
  { name: "JavaScript", pct: 78 },
  { name: "React", pct: 65 },
  { name: "AWS", pct: 58 },
  { name: "Docker", pct: 52 },
  { name: "SQL", pct: 48 },
];

function MiniBar({ name, pct, delay }: { name: string; pct: number; delay: number }) {
  return (
    <motion.div
      className="flex items-center gap-2 text-xs"
      initial={{ opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.4 + delay * 0.08, duration: 0.4 }}
    >
      <span className="w-16 text-right text-text-muted">{name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="ai-gradient h-full rounded-full"
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 + delay * 0.08, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 font-mono text-text-muted">{pct}%</span>
    </motion.div>
  );
}

const KPIS = [
  { label: "Tổng số jobs", value: "2,847", note: "+12%", tone: "text-brand-300" },
  { label: "Lương TB", value: "25.4M", note: "VND", tone: "text-success" },
  { label: "Có lương", value: "68%", note: "công khai", tone: "text-warning" },
];

/**
 * FloatingDashboard — the landing hero showpiece: a tilted dark-glass
 * <GlowCard/> mock of the product dashboard (KPI tiles + a top-skills chart)
 * that floats on scroll. The parallax + 3D tilt are gated behind
 * `prefers-reduced-motion`; the panel then renders flat and still.
 */
export default function FloatingDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const yParallax = useTransform(scrollYProgress, [0, 1], [36, -36]);

  return (
    <motion.div
      ref={ref}
      style={{ y: reduce ? 0 : yParallax, perspective: 1200 }}
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.8, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-xl"
    >
      {/* ambient halo */}
      <div className="ai-gradient absolute -inset-6 -z-10 rounded-[2.25rem] opacity-25 blur-3xl" />

      <GlowCard
        glow
        className="overflow-hidden"
        initial={reduce ? undefined : { rotateX: 7, rotateY: -7 }}
        animate={reduce ? undefined : { rotateX: 4, rotateY: -4 }}
        whileHover={reduce ? undefined : { rotateX: 0, rotateY: 0, scale: 1.015 }}
        transition={{ type: "spring", stiffness: 90, damping: 18 }}
      >
        {/* fake browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
            <span className="h-3 w-3 rounded-full bg-green-400/80" />
          </div>
          <div className="mx-6 flex-1">
            <div className="rounded-md border border-border bg-bg/40 px-3 py-1 text-center font-mono text-[11px] text-text-muted">
              talentpulse.io/dashboard
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* KPI tiles */}
          <div className="mb-5 grid grid-cols-3 gap-3">
            {KPIS.map((kpi, i) => (
              <motion.div
                key={kpi.label}
                className="rounded-lg border border-border bg-surface-2 p-3"
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
              >
                <div className="text-[10px] uppercase tracking-wide text-text-muted">
                  {kpi.label}
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-text">{kpi.value}</div>
                <div className={`mt-0.5 text-[10px] ${kpi.tone}`}>{kpi.note}</div>
              </motion.div>
            ))}
          </div>

          {/* chart mock */}
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <div className="mb-3 text-sm font-semibold text-text">
              Top Skills đang được săn đón
            </div>
            <div className="space-y-2.5">
              {miniSkills.map((s, i) => (
                <MiniBar key={s.name} name={s.name} pct={s.pct} delay={i} />
              ))}
            </div>
          </div>
        </div>
      </GlowCard>
    </motion.div>
  );
}
