"use client";

/**
 * Faq — id="faq". Importer: app/page.tsx (rendered between ForStudents and
 * CTA on the landing page). Data source: i18n only (t.faq.items) — no
 * network calls. New file: hand-rolled accessible accordion, no external
 * accordion library.
 */

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { ChevronDown } from "@/lib/icons";
import ScrollReveal from "@/components/landing/ScrollReveal";
import type { LandingCopy } from "@/lib/landing-i18n";

export default function Faq({ t }: { t: LandingCopy }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();
  const reduce = useReducedMotion();

  const toggle = (i: number) => {
    setOpenIndex((current) => (current === i ? null : i));
  };

  return (
    <section id="faq" className="relative bg-bg py-24 sm:py-28">
      <div className="mx-auto max-w-2xl px-6">
        <ScrollReveal>
          <div className="text-center">
            <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-text">
              {t.faq.heading}
            </h2>
            <p className="mt-4 text-lg text-text-muted">{t.faq.sub}</p>
          </div>
        </ScrollReveal>

        <div className="mt-12 space-y-3">
          {t.faq.items.map((item, i) => {
            const isOpen = openIndex === i;
            const buttonId = `${baseId}-faq-button-${i}`;
            const panelId = `${baseId}-faq-panel-${i}`;

            return (
              <ScrollReveal key={item.q} delay={i * 0.05}>
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-sm">
                  <button
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-medium text-text">{item.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-text-muted transition-transform duration-200 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      }`}
                      strokeWidth={2}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={reduce ? {} : { height: 0, opacity: 0 }}
                        transition={reduce ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-4 text-sm leading-relaxed text-text-muted">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
