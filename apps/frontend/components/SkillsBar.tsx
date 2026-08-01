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
        margin={{ top: 5, right: 24, left: 115, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
        <XAxis type="number" {...chartAxisProps(theme.axis)} />
        {/* interval={0}: ep recharts ve DU moi nhan. Mac dinh no tu an bot tick
            khi thay chat, nen bieu do 15 cot chi hien ~8 ten ky nang — 7 cot con
            lai khong biet la gi, phai hover tung cai moi doc duoc.
            width={110}: di kem bat buoc. Ep du 15 nhan vao 360px thi moi nhan
            chi con ~24px; o width cu 75px thi ten dai ("machine learning",
            "phan tich du lieu") xuong 2 dong va cham nhau. Noi rong de chung nam
            gon mot dong. */}
        <YAxis
          dataKey="skill"
          type="category"
          width={110}
          interval={0}
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
