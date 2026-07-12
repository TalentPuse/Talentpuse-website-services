"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartAxisProps, useChartTheme } from "@/lib/chart-theme";
import type { SkillRow } from "@/lib/api";

export default function SkillsBar({ data }: { data: SkillRow[] }) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 24, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis type="number" {...chartAxisProps(theme.axis)} />
        <YAxis
          dataKey="skill"
          type="category"
          width={75}
          {...chartAxisProps(theme.axis)}
        />
        <Tooltip
          contentStyle={theme.tooltip}
          cursor={{ fill: theme.grid, opacity: 0.5 }}
          formatter={(value: number, _name, props) => {
            const pct = props?.payload?.pct_of_jobs;
            return [`${value} jobs (${pct}%)`, "Demand"];
          }}
        />
        <Bar
          dataKey="n_jobs"
          fill={theme.series[0]}
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          animationDuration={500}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
