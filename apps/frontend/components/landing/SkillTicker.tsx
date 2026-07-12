"use client";

import type { LandingCopy, Lang } from "@/lib/landing-i18n";
import { SKILL_DEMAND, TOP_PAYING } from "@/lib/landing-data";

type Props = { t: LandingCopy; lang: Lang };

type TickerItem = {
  key: string;
  skill: string;
  detail: string;
  yoy?: number;
};

function fmt(lang: Lang, n: number): string {
  return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US").format(n);
}

/**
 * Interleaves SKILL_DEMAND ("X jobs") and TOP_PAYING ("Y tr/mo [+YoY]") into a
 * single ~14-item ticker feed. Purely derived from static landing-data — no
 * network calls, matches the "zero runtime data dependencies" landing policy.
 */
function buildTickerItems(t: LandingCopy, lang: Lang): TickerItem[] {
  const demandItems: TickerItem[] = SKILL_DEMAND.map((d) => ({
    key: `demand-${d.skill}`,
    skill: d.skill,
    detail: `${fmt(lang, d.jobs)} ${t.statsStrip.ticker.jobsUnit}`,
  }));

  const payingItems: TickerItem[] = TOP_PAYING.map((p) => ({
    key: `paying-${p.skill}`,
    skill: p.skill,
    detail: `${p.avgTr} ${t.statsStrip.ticker.salaryUnit}`,
    yoy: p.yoy,
  }));

  const interleaved: TickerItem[] = [];
  const max = Math.max(demandItems.length, payingItems.length);
  for (let i = 0; i < max; i++) {
    if (demandItems[i]) interleaved.push(demandItems[i]);
    if (payingItems[i]) interleaved.push(payingItems[i]);
  }
  return interleaved;
}

function TickerPill({ item, t }: { item: TickerItem; t: LandingCopy }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-text-muted">
      <span className="font-medium text-text">{item.skill}</span>
      <span aria-hidden className="text-text-muted/40">
        ·
      </span>
      <span className="font-mono">{item.detail}</span>
      {item.yoy != null && (
        <span className="ml-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-semibold text-success">
          ↑{item.yoy}% {t.statsStrip.ticker.trend}
        </span>
      )}
    </span>
  );
}

export default function SkillTicker({ t, lang }: Props) {
  const items = buildTickerItems(t, lang);
  // Duplicate the array so the CSS marquee (translateX 0 -> -50%) loops seamlessly.
  const looped = [...items, ...items];

  return (
    <div
      className="marquee-paused relative w-full overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div className="marquee-track flex w-max items-center gap-8 py-2">
        {looped.map((item, i) => (
          <div key={`${item.key}-${i}`} className="flex shrink-0 items-center gap-8">
            <TickerPill item={item} t={t} />
            <span aria-hidden className="text-border">
              •
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
