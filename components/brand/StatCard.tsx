"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

import GlowCard from "./GlowCard";

type StatCardProps = {
  /** Small muted label above the value, e.g. "Active jobs". */
  label: string;
  /** The headline metric. Rendered as-is, so pre-format numbers as needed. */
  value: string | number;
  /** Signed percentage change vs. the previous period, e.g. 4.2 or -1.8. */
  delta?: number;
  className?: string;
  /** Optional slot rendered under the value, e.g. an inline sparkline. */
  children?: ReactNode;
};

/**
 * StatCard — the KPI tile used across dashboards: muted label, a big
 * tabular-nums value, an optional signed delta, and an optional slot
 * underneath for an inline sparkline or trend chart.
 */
export default function StatCard({ label, value, delta, className, children }: StatCardProps) {
  const hasDelta = typeof delta === "number" && !Number.isNaN(delta);
  const isPositive = hasDelta && delta! > 0;
  const isNegative = hasDelta && delta! < 0;
  const reduceMotion = useReducedMotion();

  return (
    <GlowCard
      className={cn(
        "p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04)] transition-shadow duration-300 hover:shadow-[0_16px_32px_-16px_rgb(15_23_42_/_0.18)]",
        className
      )}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tabular-nums text-text">{value}</span>
        {hasDelta && (
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              isPositive && "text-success",
              isNegative && "text-danger",
              !isPositive && !isNegative && "text-text-muted"
            )}
          >
            {isPositive ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </GlowCard>
  );
}
