"use client";

/**
 * ForStudents — id="students". Importer: app/page.tsx. Data source: i18n only
 * (t.studentFeatures.*) — no network calls. A balanced, uniform 4-tile grid.
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { ArrowRight, FileText, GraduationCap, MessageSquare, Search } from "@/lib/icons";
import ScrollReveal from "@/components/landing/ScrollReveal";
import type { LandingCopy } from "@/lib/landing-i18n";

type Tile = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export default function ForStudents({ t }: { t: LandingCopy }) {
  const tiles: Tile[] = [
    {
      icon: Search,
      title: t.studentFeatures.jobSearch.title,
      description: t.studentFeatures.jobSearch.description,
    },
    {
      icon: FileText,
      title: t.studentFeatures.cvReview.title,
      description: t.studentFeatures.cvReview.description,
    },
    {
      icon: MessageSquare,
      title: t.studentFeatures.mockInterview.title,
      description: t.studentFeatures.mockInterview.description,
    },
    {
      icon: GraduationCap,
      title: t.studentFeatures.tips.title,
      description: t.studentFeatures.tips.description,
    },
  ];

  return (
    <section id="students" className="relative border-y border-border bg-surface-2/30">
      <div className="mx-auto max-w-[1600px] px-6 py-24">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
              {t.studentFeatures.badge}
            </span>
            <h2 className="mt-4 font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-text">
              {t.studentFeatures.heading}
            </h2>
            <p className="mt-4 text-lg text-text-muted">{t.studentFeatures.sub}</p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile, i) => {
            const Icon = tile.icon;
            return (
              <ScrollReveal key={tile.title} delay={i * 0.08}>
                <div className="flex h-full flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm transition-colors duration-300 hover:border-brand-500/50">
                  <span className="ai-gradient grid h-12 w-12 place-items-center rounded-xl text-white shadow-sm">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-text">{tile.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{tile.description}</p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal>
          <div className="mt-12 text-center">
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-base font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              {t.studentFeatures.cta}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
