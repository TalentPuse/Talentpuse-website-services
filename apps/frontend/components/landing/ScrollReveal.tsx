"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
  className?: string;
};

const offsets = {
  up: { x: 0, y: 40 },
  left: { x: -60, y: 0 },
  right: { x: 60, y: 0 },
};

export default function ScrollReveal({
  children,
  delay = 0,
  direction = "up",
  className,
}: Props) {
  const reduce = useReducedMotion();
  // With reduced motion, keep a gentle opacity fade but drop all translation.
  const offset = reduce ? { x: 0, y: 0 } : offsets[direction];

  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
