"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import HeroAiDemo from "@/components/landing/HeroAiDemo";
import GradientBackground from "@/components/landing/GradientBackground";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { ArrowRight, Sparkles } from "@/lib/icons";
import type { LandingCopy, Lang } from "@/lib/landing-i18n";

type Props = { t: LandingCopy; lang: Lang };

export default function Hero({ t, lang }: Props) {
  const reduce = useReducedMotion();

  return (
    <section className="relative min-h-[85vh] overflow-hidden bg-bg pb-20 pt-28 sm:pt-32">
      <GradientBackground />

      <div className="relative mx-auto grid max-w-[1600px] grid-cols-1 gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        {/* Copy */}
        <div>
          <ScrollReveal delay={0.05}>
            <h1 className="mt-6 font-display text-[clamp(2.5rem,5.5vw,4.5rem)] font-bold leading-[1.05] tracking-tight text-text">
              {t.hero.lead}
              <motion.span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, var(--color-brand-600) 0%, var(--color-brand-400) 55%, var(--color-brand-600) 100%)",
                  backgroundSize: "220% 100%",
                }}
                animate={reduce ? undefined : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: "linear" }}
              >
                {t.hero.highlight}
              </motion.span>
              {t.hero.tail}
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p className="mt-6 max-w-xl text-lg text-text-muted">{t.hero.sub}</p>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 font-medium text-white transition hover:scale-[1.02] hover:brightness-110"
              >
                {t.hero.ctaPrimary}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
              <button
                type="button"
                onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 font-medium text-text transition hover:bg-surface-2"
              >
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
                {t.hero.ctaSecondary}
              </button>
            </div>
          </ScrollReveal>
        </div>

        {/* AI demo showpiece */}
        <ScrollReveal direction="left" delay={0.15}>
          <div id="demo" className="relative">
            <HeroAiDemo t={t} lang={lang} />
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
