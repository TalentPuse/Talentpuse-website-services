"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { useChartTheme } from "@/lib/chart-theme";
import type { ProLanguageRow } from "@/lib/api";

export default function LanguagesDonut({ data }: { data: ProLanguageRow[] }) {
  const theme = useChartTheme();

  const chartData = data.map((d) => ({
    ...d,
    name: d.level ? `${d.lang} (${d.level})` : d.lang,
  }));

  return (
    <ResponsiveContainer width="100%" height={360}>
      <PieChart margin={{ top: 5, right: 24, bottom: 5, left: 24 }}>
        <Pie
          data={chartData}
          dataKey="n_jobs"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={72}
          outerRadius={122}
          paddingAngle={2}
          animationDuration={500}
        >
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={theme.series[idx % theme.series.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={theme.tooltip} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
