"use client";

/**
 * CTA — final call-to-action panel. Importer: app/page.tsx (rendered after
 * Faq, before Footer). Data source: i18n only (t.cta.*) — no network calls.
 */

import Link from "next/link";

import { ArrowRight } from "@/lib/icons";
import Aurora from "@/components/brand/Aurora";
import ScrollReveal from "@/components/landing/ScrollReveal";
import type { LandingCopy } from "@/lib/landing-i18n";

export default function CTA({ t }: { t: LandingCopy }) {
  return (
    <section className="relative overflow-hidden bg-bg py-24 sm:py-28">
      <Aurora className="opacity-50" />
      <div className="relative mx-auto max-w-3xl px-6">
        <ScrollReveal>
          <div className="ai-glow rounded-[var(--radius-lg)] border border-brand-500/30 bg-brand-600/10 p-10 text-center shadow-sm">
            <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-text">
              {t.cta.heading}
            </h2>
            <p className="mt-3 text-lg text-text-muted">{t.cta.sub}</p>
            <Link
              href="/signup"
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-base font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              {t.cta.button}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
            <p className="mt-3 text-xs text-text-muted">{t.cta.note}</p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
