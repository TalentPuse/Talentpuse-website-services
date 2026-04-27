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

import type { SalaryByLevelRow } from "@/lib/api";

export default function SalaryByLevel({ data }: { data: SalaryByLevelRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 16, right: 24, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="level_city"
          stroke="#64748b"
          fontSize={11}
          angle={-25}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(v) => `${v}M`}
          label={{
            value: "VND (millions/month)",
            angle: -90,
            position: "insideLeft",
            style: { fontSize: 12, fill: "#64748b" },
          }}
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
          }}
          formatter={(value: number) => `${value}M VND`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="p25_million" name="P25 (low)" fill="#94a3b8" />
        <Bar dataKey="p50_million" name="Median" fill="#2563eb" />
        <Bar dataKey="p75_million" name="P75 (high)" fill="#f59e0b" />
      </BarChart>
    </ResponsiveContainer>
  );
}
