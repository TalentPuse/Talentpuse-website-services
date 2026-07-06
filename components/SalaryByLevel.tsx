"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartAxisProps, useChartTheme } from "@/lib/chart-theme";
import type { SalaryByLevelRow } from "@/lib/api";

export default function SalaryByLevel({ data }: { data: SalaryByLevelRow[] }) {
  const theme = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis
          dataKey="level_city"
          angle={-25}
          textAnchor="end"
          interval={0}
          {...chartAxisProps(theme.axis)}
        />
        <YAxis
          tickFormatter={(v) => `${v}M`}
          label={{
            value: "VND (millions/month)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: theme.axis },
          }}
          {...chartAxisProps(theme.axis)}
        />
        <Tooltip contentStyle={theme.tooltip} formatter={(value: number) => `${value}M VND`} />
        <Legend wrapperStyle={{ fontSize: 12, color: theme.axis }} />
        <Bar dataKey="p25_million" name="P25 (low)" fill={theme.series[2]} />
        <Bar dataKey="p50_million" name="Median" fill={theme.series[0]} />
        <Bar dataKey="p75_million" name="P75 (high)" fill={theme.series[4]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
