"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import ScrollReveal from "@/components/landing/ScrollReveal";
import { BadgeDollarSign, Bell, ClipboardCheck, Sparkles, Target } from "@/lib/icons";
import type { LandingCopy } from "@/lib/landing-i18n";
import { DEMO_TRACKED_APPS, type TrackedStatus } from "@/lib/landing-data";

type TileId = "coach" | "alerts" | "salary" | "skillgap" | "tracker" | "interview";

type Tile = {
  id: TileId;
  icon: LucideIcon;
  span: string;
};

// Application manager is the flagship — it gets the large 2x2 tile.
const TILES: readonly Tile[] = [
  { id: "tracker", icon: ClipboardCheck, span: "col-span-2 row-span-2 md:col-span-2 md:row-span-2" },
  { id: "coach", icon: Sparkles, span: "" },
  { id: "alerts", icon: Bell, span: "" },
  { id: "salary", icon: BadgeDollarSign, span: "" },
  { id: "skillgap", icon: Target, span: "" },
];

const STATUS_STYLE: Record<TrackedStatus, string> = {
  applied: "bg-blue-50 text-blue-700",
  interviewing: "bg-amber-50 text-amber-700",
  offer: "bg-emerald-50 text-emerald-700",
};

export default function BentoFeatures({ t }: { t: LandingCopy }) {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-[1600px] px-6 py-24 sm:py-28">
      <ScrollReveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-text">
            {t.bento.heading}
          </h2>
          <p className="mt-4 text-lg text-text-muted">{t.bento.sub}</p>
        </div>
      </ScrollReveal>

      <div className="mt-14 grid grid-cols-2 auto-rows-[minmax(0,1fr)] gap-4 md:grid-cols-4">
        {TILES.map((tile, i) => {
          const copy = t.bento[tile.id];
          const Icon = tile.icon;
          const isLarge = tile.id === "tracker";

          return (
            <motion.div
              key={tile.id}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={tile.span}
            >
              <div className="group relative flex h-full flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm transition-all hover:scale-[1.02] hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-900/5">
                {isLarge && "badge" in copy && (
                  <span className="ai-gradient absolute right-4 top-4 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white">
                    {copy.badge}
                  </span>
                )}

                <span className="ai-gradient grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-md)] text-white">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>

                <h3 className="mt-4 font-display font-semibold text-text">{copy.title}</h3>
                <p className="mt-1.5 text-sm text-text-muted">{copy.desc}</p>

                {isLarge && (
                  <div className="mt-5 space-y-2">
                    {DEMO_TRACKED_APPS.slice(0, 3).map((app) => (
                      <div
                        key={app.company}
                        className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2/60 px-3 py-2"
                      >
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-xs font-semibold text-text-muted">
                          {app.company.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-text">{app.role}</p>
                          <p className="truncate text-[11px] text-text-muted">{app.company}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[app.status]}`}
                        >
                          {t.heroDemo.statuses[app.status]}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
