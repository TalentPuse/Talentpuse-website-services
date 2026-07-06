"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ClipboardCheck, Check, ICON } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { applicationsApi } from "@/lib/api";

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

  async function apply(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!token || done) return;
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
      variant={done ? "secondary" : "outline"}
      size="sm"
      onClick={apply}
      disabled={done || saving}
      aria-label="Đánh dấu đã apply"
    >
      {done ? <Check {...ICON} className="h-4 w-4" /> : <ClipboardCheck {...ICON} className="h-4 w-4" />}
      Đã apply
    </Button>
  );
}
