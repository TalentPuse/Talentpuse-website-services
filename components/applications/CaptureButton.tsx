"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { ClipboardCheck, Check, ICON } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { applicationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type CaptureButtonProps = {
  source: string;
  sourceJobId: string;
  tracked?: boolean;
};

/**
 * CaptureButton — one-click "Đã apply" capture for a job board card or
 * alert row. Creates (or idempotently reuses) a job_applications record via
 * `applicationsApi.create`, then flips to a done state. Stops propagation so
 * it can sit inside a clickable card without triggering the card's own link.
 */
export default function CaptureButton({ source, sourceJobId, tracked = false }: CaptureButtonProps) {
  const { token } = useAuth();
  const [done, setDone] = useState(tracked);
  const [saving, setSaving] = useState(false);
  const isDone = done || tracked;
  const shouldReduceMotion = useReducedMotion();

  async function apply(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!token || isDone) return;
    setSaving(true);
    try {
      await applicationsApi.create(token, { source, source_job_id: sourceJobId });
      setDone(true);
      toast.success("Đã lưu vào Ứng tuyển");
    } catch {
      toast.error("Không lưu được");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button
      type="button"
      variant={isDone ? "secondary" : "outline"}
      size="sm"
      onClick={apply}
      disabled={isDone || saving}
      aria-label={isDone ? "Đã lưu vào ứng tuyển" : "Đánh dấu đã apply"}
      className={cn("transition-transform active:scale-95")}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDone ? (
          <motion.span
            key="done"
            className="inline-flex"
            initial={shouldReduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 20 }}
          >
            <Check {...ICON} className="h-4 w-4" />
          </motion.span>
        ) : (
          <motion.span
            key="pending"
            className="inline-flex"
            initial={shouldReduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <ClipboardCheck {...ICON} className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
      Đã apply
    </Button>
  );
}
