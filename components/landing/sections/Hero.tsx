"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import FloatingDashboard from "@/components/landing/FloatingDashboard";
import GradientBackground from "@/components/landing/GradientBackground";
import { translations } from "@/lib/landing-i18n";

type Dict = (typeof translations)["vi"];

const CHANNELS = ["Telegram", "Zalo", "Discord", "Email"];

const fadeUp = {
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
};

export default function Hero({ t }: { t: Dict }) {
  return (
    <section className="relative overflow-hidden bg-bg">
      <GradientBackground />

      <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-10">
          {/* Copy */}
          <div className="lg:col-span-6">
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
              </span>
              <span className="ai-text">{t.hero.badge}</span>
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-text sm:text-5xl lg:text-6xl"
            >
              {t.hero.heading1}
              <span className="ai-text">{t.hero.heading2}</span>
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-text-muted"
            >
              {t.hero.sub}
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/signup"
                className="ai-gradient ai-glow group inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                {t.hero.ctaPrimary}
                <ArrowRight
                  size={18}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center justify-center rounded-xl border border-border bg-surface px-7 py-3.5 text-base font-semibold text-text backdrop-blur transition-colors hover:bg-surface-2"
              >
                {t.hero.ctaSecondary}
              </Link>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="mt-8 flex flex-wrap items-center gap-2"
            >
              <span className="text-xs uppercase tracking-wide text-text-muted">
                {t.aiAlert.sentVia}
              </span>
              {CHANNELS.map((ch) => (
                <span
                  key={ch}
                  className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted"
                >
                  {ch}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Showpiece */}
          <div className="relative lg:col-span-6">
            <FloatingDashboard />
          </div>
        </div>
      </div>
    </section>
  );
}
