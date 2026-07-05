"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

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
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 1 + delay * 0.1, duration: 0.4 }}
    >
      <span className="w-16 text-slate-500 text-right">{name}</span>
      <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-linear-to-r from-brand-500 to-brand-400 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 1.2 + delay * 0.1, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="w-8 text-slate-400">{pct}%</span>
    </motion.div>
  );
}

export default function FloatingDashboard() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [60, -60]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      initial={{ opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.8, ease: "easeOut" }}
      className="relative mx-auto max-w-4xl"
    >
      <div className="absolute -inset-4 bg-linear-to-b from-brand-400/20 to-transparent rounded-3xl blur-2xl" />
      <motion.div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden"
        style={{ perspective: 1000 }}
        whileHover={{ rotateX: 0, rotateY: 0, scale: 1.02 }}
        initial={{ rotateX: 8, rotateY: -4 }}
        animate={{ rotateX: 4, rotateY: -2 }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      >
        {/* Fake browser top bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-8">
            <div className="bg-white rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-400 text-center">
              talentpulse.io/dashboard
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* KPI cards row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <motion.div
              className="bg-linear-to-br from-brand-50 to-white rounded-lg border border-brand-100 p-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Tổng số jobs
              </div>
              <div className="text-xl font-bold text-brand-700 mt-1">2,847</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">+12% ↑</div>
            </motion.div>
            <motion.div
              className="bg-linear-to-br from-emerald-50 to-white rounded-lg border border-emerald-100 p-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7, duration: 0.4 }}
            >
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Lương trung bình
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1">25.4M</div>
              <div className="text-[10px] text-emerald-600 mt-0.5">VND/tháng</div>
            </motion.div>
            <motion.div
              className="bg-linear-to-br from-amber-50 to-white rounded-lg border border-amber-100 p-3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Có mức lương
              </div>
              <div className="text-xl font-bold text-amber-700 mt-1">68%</div>
              <div className="text-[10px] text-amber-600 mt-0.5">công khai</div>
            </motion.div>
          </div>

          {/* Chart area */}
          <div className="bg-slate-50 rounded-lg border border-slate-100 p-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">
              Top Skills đang được săn đón
            </div>
            <div className="space-y-2.5">
              {miniSkills.map((s, i) => (
                <MiniBar key={s.name} name={s.name} pct={s.pct} delay={i} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-linear-to-t from-white to-transparent pointer-events-none" />
    </motion.div>
  );
}
