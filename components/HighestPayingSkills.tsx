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
import type { HighestPayingSkillRow } from "@/lib/api";

export default function HighestPayingSkills({
  data,
}: {
  data: HighestPayingSkillRow[];
}) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 24, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${v}M`}
          {...chartAxisProps(theme.axis)}
        />
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
            const n = props?.payload?.n_jobs;
            return [`${value}M VND/month (${n} jobs)`, "Avg salary"];
          }}
        />
        <Bar
          dataKey="avg_salary_million"
          fill={theme.series[3]}
          radius={[0, 4, 4, 0]}
          maxBarSize={28}
          animationDuration={500}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
