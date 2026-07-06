"use client";

import type { LucideIcon } from "lucide-react";
import { BarChart3, Bell, Database } from "lucide-react";

import ScrollReveal from "@/components/landing/ScrollReveal";
import GlowCard from "@/components/brand/GlowCard";
import { translations } from "@/lib/landing-i18n";

type Dict = (typeof translations)["vi"];

export default function HowItWorks({ t }: { t: Dict }) {
  const steps: {
    num: string;
    icon: LucideIcon;
    title: string;
    desc: string;
  }[] = [
    { num: "01", icon: Database, title: t.howItWorks.step1.title, desc: t.howItWorks.step1.description },
    { num: "02", icon: BarChart3, title: t.howItWorks.step2.title, desc: t.howItWorks.step2.description },
    { num: "03", icon: Bell, title: t.howItWorks.step3.title, desc: t.howItWorks.step3.description },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
      <ScrollReveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-brand-300">
            {t.howItWorks.badge}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
            {t.howItWorks.heading}
          </h2>
          <p className="mt-4 text-lg text-text-muted">{t.howItWorks.sub}</p>
        </div>
      </ScrollReveal>

      <div className="relative mt-16 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
        {/* connecting rail (desktop) */}
        <div
          aria-hidden="true"
          className="ai-gradient absolute left-0 right-0 top-7 hidden h-px opacity-20 md:block"
        />
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <ScrollReveal key={i} delay={i * 0.12}>
              <GlowCard className="group relative h-full p-8 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <span className="ai-gradient grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg">
                    <Icon size={24} strokeWidth={1.75} />
                  </span>
                  <span className="font-display text-4xl font-bold text-text/10">{step.num}</span>
                </div>
                <h3 className="mt-6 text-lg font-semibold text-text">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">{step.desc}</p>
              </GlowCard>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
