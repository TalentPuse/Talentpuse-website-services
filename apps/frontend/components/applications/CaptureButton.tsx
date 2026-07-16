"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";

import { ClipboardCheck, Check, ICON } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { applicationsApi, type TrackedKey } from "@/lib/api";
import { cn } from "@/lib/utils";

type CaptureButtonProps = {
  source: string;
  sourceJobId: string;
  /** Existing tracker row for this job, if the user already saved/applied it. */
  tracked?: TrackedKey | null;
  /** Fires with the new/updated row so the parent can refresh its tracked map. */
  onTracked?: (entry: TrackedKey) => void;
};

/**
 * CaptureButton — the job board / alert row entry point into the Ứng tuyển
 * tracker. Renders both pipeline entry actions, so "saved" is reachable from
 * the board instead of only by downgrading an applied row inside the tracker:
 *
 *   untracked      -> [Lưu] [Đã apply]
 *   status "saved" -> [Đã lưu] [Đã apply]   (apply upgrades the existing row)
 *   applied+       -> [Đã apply ✓]          (terminal for this control)
 *
 * Stops propagation so it can sit inside a clickable card without triggering
 * the card's own link.
 */
export default function CaptureButton({
  source,
  sourceJobId,
  tracked = null,
  onTracked,
}: CaptureButtonProps) {
  const { token } = useAuth();
  const [busy, setBusy] = useState<"saved" | "applied" | null>(null);
  const reduceMotion = useReducedMotion();

  const status = tracked?.status ?? null;
  const isSaved = status === "saved";
  // Anything past "saved" (applied/interviewing/offer/rejected) is already in
  // the pipeline — the board should not offer to re-capture it.
  const isApplied = status !== null && status !== "saved";

  async function capture(next: "saved" | "applied", e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!token || busy) return;
    setBusy(next);
    try {
      // POST is idempotent: for a row that already exists it returns the row
      // unchanged, so upgrading saved -> applied has to go through PATCH.
      const entry =
        next === "applied" && tracked
          ? await applicationsApi.update(token, tracked.id, { status: "applied" })
          : await applicationsApi.create(token, {
              source,
              source_job_id: sourceJobId,
              status: next,
            });
      onTracked?.({
        id: entry.id,
        source,
        source_job_id: sourceJobId,
        status: entry.status,
      });
      toast.success(next === "saved" ? "Đã lưu job" : "Đã lưu vào Ứng tuyển");
    } catch {
      toast.error(next === "saved" ? "Không lưu được" : "Không đánh dấu được");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {!isApplied && (
        <Button
          type="button"
          variant={isSaved ? "secondary" : "outline"}
          size="sm"
          onClick={(e) => capture("saved", e)}
          disabled={isSaved || busy !== null}
          aria-label={isSaved ? "Đã lưu job này" : "Lưu job để xem sau"}
          className={cn("transition-transform active:scale-95")}
        >
          {isSaved && <Check {...ICON} className="h-4 w-4" />}
          {isSaved ? "Đã lưu" : busy === "saved" ? "Đang lưu…" : "Lưu"}
        </Button>
      )}
      <Button
        type="button"
        variant={isApplied ? "secondary" : "outline"}
        size="sm"
        onClick={(e) => capture("applied", e)}
        disabled={isApplied || busy !== null}
        aria-label={isApplied ? "Đã đánh dấu apply" : "Đánh dấu đã apply"}
        className={cn("transition-transform active:scale-95")}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isApplied ? (
            <motion.span
              key="done"
              className="inline-flex"
              initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              <Check {...ICON} className="h-4 w-4" />
            </motion.span>
          ) : (
            <motion.span
              key="pending"
              className="inline-flex"
              initial={reduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              <ClipboardCheck {...ICON} className="h-4 w-4" />
            </motion.span>
          )}
        </AnimatePresence>
        Đã apply
      </Button>
    </div>
  );
}
