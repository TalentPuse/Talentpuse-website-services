"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import Aurora from "@/components/brand/Aurora";
import GlowCard from "@/components/brand/GlowCard";
import Monogram from "@/components/brand/Monogram";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { CheckCircle2 } from "@/lib/icons";
import { translations } from "@/lib/landing-i18n";

type Dict = (typeof translations)["vi"];

/**
 * Static, purge-safe variant map for match-score accents. Replaces the old
 * dynamic `bg-${n.color}-*` template strings, which Tailwind v4 cannot see
 * and would purge. Every class here is a literal token utility.
 */
type MatchTone = "emerald" | "brand" | "amber";
const MATCH_STYLES: Record<MatchTone, string> = {
  emerald: "bg-success/15 text-success",
  brand: "bg-brand-500/15 text-brand-300",
  amber: "bg-warning/15 text-warning",
};

type Notification = {
  match: number;
  tone: MatchTone;
  title: string;
  company: string;
  location: string;
  salary: string;
  skills: string;
  time: string;
  unit: "min" | "hour";
  offset: string;
};

export default function AIShowcase({ t }: { t: Dict }) {
  const bullets = [
    { title: t.aiAlert.bullet1Title, desc: t.aiAlert.bullet1 },
    { title: t.aiAlert.bullet2Title, desc: t.aiAlert.bullet2 },
    { title: t.aiAlert.bullet3Title, desc: t.aiAlert.bullet3 },
  ];

  const notifications: Notification[] = [
    {
      match: 95,
      tone: "emerald",
      title: "Senior React Developer",
      company: "FPT Software",
      location: "Ho Chi Minh",
      salary: "30-45M VND",
      skills: "React, TypeScript, AWS",
      time: "2",
      unit: "min",
      offset: "",
    },
    {
      match: 88,
      tone: "brand",
      title: "AI/ML Engineer",
      company: "VNG Corporation",
      location: "Ho Chi Minh",
      salary: "40-60M VND",
      skills: "Python, PyTorch, LLM",
      time: "15",
      unit: "min",
      offset: "lg:ml-8",
    },
    {
      match: 82,
      tone: "amber",
      title: "DevOps Engineer",
      company: "Tiki",
      location: "Hanoi",
      salary: "25-40M VND",
      skills: "Docker, K8s, Terraform",
      time: "1",
      unit: "hour",
      offset: "lg:ml-3",
    },
  ];

  return (
    <section id="ai-alert" className="relative overflow-hidden bg-bg">
      <Aurora className="opacity-50" />
      <div className="relative mx-auto max-w-6xl px-6 py-24">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          {/* Copy */}
          <ScrollReveal direction="left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
              </span>
              <span className="ai-text text-xs font-semibold">{t.aiAlert.badge}</span>
            </div>

            <h2 className="mt-6 whitespace-pre-line font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
              {t.aiAlert.heading}
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-text-muted">
              {t.aiAlert.description}
            </p>

            <ul className="mt-8 space-y-4">
              {bullets.map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2
                    size={20}
                    strokeWidth={2}
                    className="mt-0.5 shrink-0 text-brand-400"
                  />
                  <span className="text-text-muted">
                    <strong className="font-semibold text-text">{item.title}</strong>
                    {item.desc}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="ai-gradient ai-glow group mt-9 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              {t.aiAlert.cta}
              <ArrowRight
                size={18}
                strokeWidth={2}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </ScrollReveal>

          {/* Notification cards */}
          <div className="flex flex-col gap-4 lg:pl-6">
            {notifications.map((n, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 40, y: 16 }}
                whileInView={{ opacity: 1, x: 0, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.15, duration: 0.55 }}
                className={n.offset}
              >
                <GlowCard glow={i === 0} className="p-4">
                  <div className="flex items-start gap-3">
                    <Monogram name={n.company} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${MATCH_STYLES[n.tone]}`}
                        >
                          {t.notifications.match} {n.match}%
                        </span>
                        <span className="shrink-0 font-mono text-xs text-text-muted">
                          {n.time} {n.unit === "min" ? t.notifications.minAgo : t.notifications.hourAgo}
                        </span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-semibold text-text">{n.title}</h4>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {n.company} &middot; {n.location}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="shrink-0 rounded font-mono text-xs font-medium text-brand-300">
                          {n.salary}
                        </span>
                        <span className="truncate text-xs text-text-muted">{n.skills}</span>
                      </div>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
