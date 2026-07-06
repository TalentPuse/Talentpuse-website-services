"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

type Props = {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
};

export default function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 2,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    // Respect reduced-motion: snap straight to the final figure.
    if (reduce) {
      setDisplay(Math.round(target).toLocaleString());
      return;
    }
    motionValue.set(target);
  }, [isInView, motionValue, target, reduce]);

  useEffect(() => {
    if (reduce) return;
    const unsub = spring.on("change", (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsub;
  }, [spring, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
