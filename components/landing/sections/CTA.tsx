"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import Aurora from "@/components/brand/Aurora";
import GlowCard from "@/components/brand/GlowCard";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { translations } from "@/lib/landing-i18n";

type Dict = (typeof translations)["vi"];

export default function CTA({ t }: { t: Dict }) {
  return (
    <section className="relative overflow-hidden bg-bg py-24 sm:py-28">
      <Aurora className="opacity-60" />
      <div className="relative mx-auto max-w-4xl px-6">
        <ScrollReveal>
          <GlowCard glow className="overflow-hidden px-6 py-16 text-center sm:px-16">
            <h2 className="font-display text-3xl font-bold tracking-tight text-text sm:text-5xl">
              {t.cta.heading}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-lg text-text-muted">{t.cta.sub}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="ai-gradient ai-glow group inline-flex items-center gap-2 rounded-xl px-8 py-4 text-lg font-semibold text-white transition-transform hover:scale-[1.02]"
              >
                {t.cta.button}
                <ArrowRight
                  size={20}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/signin"
                className="text-sm font-medium text-text-muted underline decoration-border underline-offset-4 transition-colors hover:text-text hover:decoration-text"
              >
                {t.cta.orSignIn}
              </Link>
            </div>
          </GlowCard>
        </ScrollReveal>
      </div>
    </section>
  );
}
