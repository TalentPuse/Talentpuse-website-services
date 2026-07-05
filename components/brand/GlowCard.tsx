"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

type GlowCardProps = HTMLMotionProps<"div"> & {
  /** Adds the ai-glow accent ring (indigo/cyan halo) around the panel. */
  glow?: boolean;
};

/**
 * GlowCard — the shared glass-panel primitive used across the dashboard:
 * blurred surface, hairline border, optional ai-glow accent ring.
 *
 * Built on `motion.div` so callers can layer in entrance/hover motion
 * (`initial`/`animate`, `whileHover`, `whileTap`, ...) without adding a
 * second wrapper — the panel itself stays static unless a caller opts in.
 */
export default function GlowCard({ glow = false, className, children, ...rest }: GlowCardProps) {
  return (
    <motion.div
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-surface backdrop-blur",
        glow && "ai-glow",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
