"use client";

import AnimatedCounter from "@/components/landing/AnimatedCounter";
import SkillTicker from "@/components/landing/SkillTicker";
import { LANDING_STATS } from "@/lib/landing-data";
import type { LandingCopy, Lang } from "@/lib/landing-i18n";

type Props = { t: LandingCopy; lang: Lang };

type StatItem = {
  key: string;
  target: number;
  suffix: string;
  label: string;
};

export default function StatsStrip({ t, lang }: Props) {
  const stats: StatItem[] = [
    {
      key: "jobsAnalyzed",
      target: LANDING_STATS.jobsAnalyzed,
      suffix: "",
      label: t.statsStrip.jobsAnalyzed,
    },
    {
      key: "companies",
      target: LANDING_STATS.companies,
      suffix: "+",
      label: t.statsStrip.companies,
    },
    {
      key: "skillsTracked",
      target: LANDING_STATS.skillsTracked,
      suffix: "+",
      label: t.statsStrip.skillsTracked,
    },
    {
      key: "refresh",
      target: LANDING_STATS.refreshHours,
      suffix: "h",
      label: t.statsStrip.refresh,
    },
  ];

  return (
    <section className="border-y border-border bg-surface py-14">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.key} className="text-center">
              <div className="font-mono text-3xl font-bold text-brand-600 sm:text-4xl">
                <AnimatedCounter target={s.target} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-sm text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>

      </div>

      <div className="mt-10">
        <SkillTicker t={t} lang={lang} />
      </div>
    </section>
  );
}
