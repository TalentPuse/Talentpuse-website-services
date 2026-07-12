"use client";

/**
 * Facts for GateGuard:
 * - Importer: app/page.tsx (wired in alongside the other landing sections).
 * - Purpose: market-data story section — skill-demand chart, salary explorer,
 *   top-paying-skills table, for the public landing page `/`.
 * - Data source: static constants in lib/landing-data.ts (SKILL_DEMAND, TOP_PAYING).
 *   NO network calls, NO runtime data dependency — deliberate product decision.
 * - User instruction (verbatim): "OKE CODE ĐI NHEN BẠN KHOIỈ VIÊTÝ PLAN"
 */

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import ScrollReveal from "@/components/landing/ScrollReveal";
import SalaryExplorer from "@/components/landing/SalaryExplorer";
import { chartAxisProps, useChartTheme } from "@/lib/chart-theme";
import { SKILL_DEMAND, TOP_PAYING } from "@/lib/landing-data";
import type { Lang, LandingCopy } from "@/lib/landing-i18n";

type Props = { t: LandingCopy; lang: Lang };

function fmt(lang: Lang, n: number): string {
  return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US").format(n);
}

export default function DataStory({ t, lang }: Props) {
  const theme = useChartTheme();
  const copy = t.dataStory;
  const chartData = [...SKILL_DEMAND];
  const chartHeight = Math.max(240, chartData.length * 38);

  return (
    <section id="data" className="relative py-20 sm:py-24">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-text">
            {copy.heading}
          </h2>
          <p className="mt-3 text-text-muted">{copy.sub}</p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <ScrollReveal direction="left">
            <div className="h-full rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm">
              <h3 className="font-display text-base font-semibold text-text">{copy.chartTitle}</h3>
              <div className="mt-4" style={{ width: "100%", height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
                    <XAxis type="number" {...chartAxisProps(theme.axis)} tickFormatter={(v) => fmt(lang, Number(v))} />
                    <YAxis type="category" dataKey="skill" width={90} {...chartAxisProps(theme.axis)} />
                    <Tooltip
                      cursor={{ fill: "rgba(37, 99, 235, 0.08)" }}
                      contentStyle={theme.tooltip}
                      labelStyle={{ color: theme.axis }}
                      formatter={(value) => [`${fmt(lang, Number(value))} ${copy.chartUnit}`, ""]}
                    />
                    <Bar dataKey="jobs" fill="#2563eb" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={0.1}>
            <SalaryExplorer t={t} lang={lang} />
          </ScrollReveal>
        </div>

        <ScrollReveal delay={0.15}>
          <div className="mt-6 overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-sm">
            <h3 className="font-display text-base font-semibold text-text">{copy.topPaying.title}</h3>
            <table className="mt-4 w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {copy.topPaying.colSkill}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {copy.topPaying.colSalary}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {copy.topPaying.colJobs}
                  </th>
                </tr>
              </thead>
              <tbody>
                {TOP_PAYING.map((row) => (
                  <tr key={row.skill} className="border-b border-border/60 transition hover:bg-brand-600/10">
                    <td className="py-3 pr-4 font-medium text-text">{row.skill}</td>
                    <td className="py-3 pr-4 font-mono text-text">
                      {row.avgTr}
                      {copy.topPaying.unit}
                      {row.yoy !== undefined && (
                        <span className="ml-2 rounded-full bg-brand-500/15 px-2 py-0.5 font-sans text-xs font-medium text-brand-700">
                          ↑{row.yoy}% YoY
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-text-muted">{fmt(lang, row.jobs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
