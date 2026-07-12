"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import ScrollReveal from "@/components/landing/ScrollReveal";
import GlowCard from "@/components/brand/GlowCard";
import { ArrowRight, Bell, Send, Sparkles, Zap } from "@/lib/icons";
import type { LandingCopy } from "@/lib/landing-i18n";
import { MOCK_ALERTS } from "@/lib/landing-data";

const BULLET_ICONS = [Sparkles, Bell, Zap] as const;

export default function AlertShowcase({ t }: { t: LandingCopy }) {
  const reduce = useReducedMotion();
  const bullets = [t.alertShowcase.bullet1, t.alertShowcase.bullet2, t.alertShowcase.bullet3];

  return (
    <section id="features" className="mx-auto max-w-[1600px] px-6 py-24 sm:py-28">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Left: copy */}
        <ScrollReveal direction="left">
          <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-brand-700">
            {t.alertShowcase.badge}
          </span>
          <h2 className="mt-4 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-tight tracking-tight text-text">
            {t.alertShowcase.heading}
          </h2>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-text-muted">
            {t.alertShowcase.sub}
          </p>

          <ul className="mt-8 space-y-4">
            {bullets.map((bullet, i) => {
              const Icon = BULLET_ICONS[i % BULLET_ICONS.length];
              return (
                <li key={i} className="flex items-start gap-3">
                  <span className="ai-gradient grid h-7 w-7 shrink-0 place-items-center rounded-full text-white">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <span className="pt-0.5 text-text-muted">{bullet}</span>
                </li>
              );
            })}
          </ul>

          <Link
            href="/signup"
            className="mt-9 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
          >
            {t.alertShowcase.cta}
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </ScrollReveal>

        {/* Right: phone-frame mock */}
        <ScrollReveal direction="right" delay={0.1}>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[28px] border border-border bg-surface shadow-xl shadow-brand-900/5">
            <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-3.5">
              <span className="ai-gradient grid h-7 w-7 place-items-center rounded-full text-white">
                <Bell className="h-4 w-4" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight text-text">{t.alertShowcase.phoneHeader}</p>
                <p className="truncate text-[11px] leading-tight text-text-muted">
                  {t.alertShowcase.sourcesLabel}
                </p>
              </div>
              <Send className="ml-auto h-4 w-4 text-text-muted" strokeWidth={1.75} />
            </div>

            <div className="space-y-3 p-4">
              {MOCK_ALERTS.map((alert, i) => {
                const copy = t.alertShowcase.alerts[alert.key];
                return (
                  <motion.div
                    key={alert.key}
                    initial={reduce ? false : { opacity: 0, x: 40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <GlowCard glow={i === 0} className="rounded-md bg-surface-2 p-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="shrink-0 rounded bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                            {alert.source}
                          </span>
                          <span className="truncate text-xs text-text-muted">{copy.company}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                          {alert.match}% {t.alertShowcase.matchLabel}
                        </span>
                      </div>
                      <h4 className="mt-1 font-medium text-text">{copy.title}</h4>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-medium text-brand-700">
                          {alert.salaryTr[0]}-{alert.salaryTr[1]}tr
                        </span>
                        <span className="text-[11px] text-text-muted">{t.alertShowcase.justNow}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {alert.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </GlowCard>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
