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

import type { HighestPayingSkillRow } from "@/lib/api";

export default function HighestPayingSkills({
  data,
}: {
  data: HighestPayingSkillRow[];
}) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 24, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(v) => `${v}M`}
        />
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
            const n = props?.payload?.n_jobs;
            return [`${value}M VND/month (${n} jobs)`, "Avg salary"];
          }}
        />
        <Bar dataKey="avg_salary_million" fill="#10b981" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
