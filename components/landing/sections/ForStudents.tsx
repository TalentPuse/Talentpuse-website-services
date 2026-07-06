"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, FileText, Lightbulb, MessageSquare, Search } from "lucide-react";

import ScrollReveal from "@/components/landing/ScrollReveal";
import GlowCard from "@/components/brand/GlowCard";
import { translations } from "@/lib/landing-i18n";
import { cn } from "@/lib/utils";

type Dict = (typeof translations)["vi"];

/** Static, purge-safe accent tiles (literal token classes). */
type Accent = "ai" | "brand" | "emerald" | "amber";
const ACCENT_TILE: Record<Accent, string> = {
  ai: "ai-gradient text-white",
  brand: "bg-brand-500/15 text-brand-300",
  emerald: "bg-success/15 text-success",
  amber: "bg-warning/15 text-warning",
};

export default function ForStudents({ t }: { t: Dict }) {
  const features: {
    icon: LucideIcon;
    title: string;
    desc: string;
    accent: Accent;
    /** Bento placement — varied cell sizes, not a uniform grid. */
    span: string;
    featured?: boolean;
  }[] = [
    {
      icon: Search,
      title: t.studentFeatures.jobSearch.title,
      desc: t.studentFeatures.jobSearch.description,
      accent: "ai",
      span: "lg:col-span-2 lg:row-span-2",
      featured: true,
    },
    {
      icon: FileText,
      title: t.studentFeatures.cvReview.title,
      desc: t.studentFeatures.cvReview.description,
      accent: "brand",
      span: "lg:col-span-2",
    },
    {
      icon: MessageSquare,
      title: t.studentFeatures.mockInterview.title,
      desc: t.studentFeatures.mockInterview.description,
      accent: "emerald",
      span: "lg:col-span-1",
    },
    {
      icon: Lightbulb,
      title: t.studentFeatures.tips.title,
      desc: t.studentFeatures.tips.description,
      accent: "amber",
      span: "lg:col-span-1",
    },
  ];

  return (
    <section id="student-features" className="relative border-y border-border bg-surface-2/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-300">
              {t.studentFeatures.badge}
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
              {t.studentFeatures.heading}
            </h2>
            <p className="mt-4 text-lg text-text-muted">{t.studentFeatures.sub}</p>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:auto-rows-[minmax(0,1fr)]">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <ScrollReveal key={i} delay={i * 0.08} className={f.span}>
                <GlowCard
                  glow={f.featured}
                  className={cn(
                    "group flex h-full flex-col p-6 transition-transform duration-300 hover:-translate-y-1",
                    f.featured && "sm:p-8"
                  )}
                >
                  <span
                    className={cn(
                      "grid place-items-center rounded-xl shadow-sm",
                      f.featured ? "h-14 w-14" : "h-12 w-12",
                      ACCENT_TILE[f.accent]
                    )}
                  >
                    <Icon size={f.featured ? 26 : 22} strokeWidth={1.75} />
                  </span>
                  <h3
                    className={cn(
                      "mt-5 font-semibold text-text",
                      f.featured ? "text-xl" : "text-base"
                    )}
                  >
                    {f.title}
                  </h3>
                  <p
                    className={cn(
                      "mt-2 leading-relaxed text-text-muted",
                      f.featured ? "text-base" : "text-sm"
                    )}
                  >
                    {f.desc}
                  </p>
                  {f.featured && (
                    <div className="mt-auto pt-6">
                      <span className="ai-text inline-flex items-center gap-1 text-sm font-semibold">
                        {t.studentFeatures.cta}
                        <ArrowRight size={16} strokeWidth={2} />
                      </span>
                    </div>
                  )}
                </GlowCard>
              </ScrollReveal>
            );
          })}
        </div>

        <ScrollReveal>
          <div className="mt-12 text-center">
            <Link
              href="/signup"
              className="ai-gradient ai-glow group inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              {t.studentFeatures.cta}
              <ArrowRight
                size={18}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
