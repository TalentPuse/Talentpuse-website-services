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
import type { ProExperienceRow } from "@/lib/api";

export default function ExperienceBuckets({ data }: { data: ProExperienceRow[] }) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 24, left: 120, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis type="number" {...chartAxisProps(theme.axis)} />
        <YAxis
          dataKey="bucket"
          type="category"
          width={115}
          interval={0}
          {...chartAxisProps(theme.axis)}
        />
        <Tooltip
          contentStyle={theme.tooltip}
          cursor={{ fill: theme.grid, opacity: 0.5 }}
          formatter={(value: number) => [`${value} jobs`, "Demand"]}
        />
        <Bar
          dataKey="n_jobs"
          fill={theme.series[4]}
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          animationDuration={500}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
