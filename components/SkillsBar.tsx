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

import type { SkillRow } from "@/lib/api";

export default function SkillsBar({ data }: { data: SkillRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 24, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" stroke="#64748b" fontSize={12} />
        <YAxis
          dataKey="skill"
          type="category"
          stroke="#64748b"
          fontSize={12}
          width={75}
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
          }}
          formatter={(value: number, _name, props) => {
            const pct = props?.payload?.pct_of_jobs;
            return [`${value} jobs (${pct}%)`, "Demand"];
          }}
        />
        <Bar dataKey="n_jobs" fill="#2563eb" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
