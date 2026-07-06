"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

import StatCard from "@/components/brand/StatCard";
import { useChartTheme } from "@/lib/chart-theme";
import { cn } from "@/lib/utils";

type Accent = "blue" | "green" | "amber" | "purple";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
  /** Optional series (e.g. a related metric across skills/levels) rendered as an inline sparkline. */
  series?: number[];
};

const accentBar: Record<Accent, string> = {
  blue: "bg-brand",
  green: "bg-success",
  amber: "bg-warning",
  purple: "bg-violet-500",
};

/** Maps each accent to a `theme.series` (--chart-1..6) index for the sparkline stroke. */
const accentSeriesIndex: Record<Accent, number> = {
  blue: 0,
  green: 3,
  amber: 4,
  purple: 2,
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={28}>
      <AreaChart data={points} margin={{ top: 2, right: 1, bottom: 0, left: 1 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill={color}
          fillOpacity={0.16}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * KpiCard — back-compat wrapper around `StatCard` (tokenized mono figures).
 * Kept so existing callers (e.g. the admin console) keep compiling and get
 * the tokenized look "for free"; the dashboard itself now renders
 * `StatCard` directly. The old accent gradient became a slim tokenized
 * top bar instead of a hardcoded per-accent gradient. When a `series` is
 * supplied, an inline sparkline (themed via `lib/chart-theme.ts`, no raw
 * hex) renders beneath the hint.
 */
export default function KpiCard({ label, value, hint, accent = "blue", series }: Props) {
  const theme = useChartTheme();
  const sparkColor = theme.series[accentSeriesIndex[accent]];

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 z-10 h-1 rounded-t-[var(--radius-lg)]",
          accentBar[accent]
        )}
      />
      <StatCard label={label} value={value}>
        {hint && <p className="text-xs text-text-muted">{hint}</p>}
        {series && series.length > 1 && (
          <div className="mt-2" aria-hidden="true">
            <Sparkline data={series} color={sparkColor} />
          </div>
        )}
      </StatCard>
    </div>
  );
}
