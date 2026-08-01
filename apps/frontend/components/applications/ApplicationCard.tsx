"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useReducedMotion } from "framer-motion";

import { Trash2, ICON } from "@/lib/icons";
import Monogram from "@/components/brand/Monogram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getSourceLabel, getSourceBadgeClass } from "@/lib/job-sources";
import { cn } from "@/lib/utils";
import type { Application } from "@/lib/api";

type ApplicationCardProps = {
  app: Application;
  onDelete: (id: string) => void;
  /** Mo panel chi tiet cho job nay. Khong truyen thi tieu de khong the bam. */
  onOpenDetail?: (app: Application) => void;
  /** Rendered inside DragOverlay — no drag wiring, just the visual. */
  isOverlay?: boolean;
};

/**
 * ApplicationCard — a single tracked job on the Ứng tuyển board.
 *
 * The card carries no status control: on a board the *column* is the status,
 * so moving the card is what changes it. Drag is wired through dnd-kit, which
 * also gives keyboard dragging for free (Space to lift, arrows, Space to drop).
 */
export default function ApplicationCard({ app, onDelete, onOpenDetail, isOverlay = false }: ApplicationCardProps) {
  const [confirming, setConfirming] = useState(false);
  const reduceMotion = useReducedMotion();

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
    disabled: isOverlay,
  });

  const date = app.applied_at
    ? new Date(app.applied_at).toLocaleDateString("vi-VN", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={transform && !reduceMotion ? { transform: CSS.Translate.toString(transform) } : undefined}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
      className={cn(
        // shrink-0: inside a scrolling column, flex children would otherwise
        // squash instead of overflowing.
        "group relative shrink-0 rounded-xl bg-surface p-2.5",
        "shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-border/70",
        "transition-[box-shadow,transform,--tw-ring-color] duration-150 ease-out",
        !isOverlay &&
          "cursor-grab touch-none hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,23,42,0.10)] hover:ring-brand-300",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60",
        // The original stays in place as a ghost; DragOverlay renders the mover.
        isDragging && "opacity-40",
        isOverlay && "cursor-grabbing rotate-2 shadow-[0_12px_28px_rgba(15,23,42,0.18)] ring-brand-300",
      )}
    >
      <div className="flex items-start gap-2">
        <Monogram name={app.company_name || app.title} />
        <div className="min-w-0 flex-1">
          {/* "Phan tieu de": vung bam de mo panel chi tiet. Dat onClick o day —
              KHONG o div ngoai cung (dong tren mang {...listeners}) — vi div
              ngoai la be mat keo-tha cua dnd-kit; gan onClick vao do thi moi
              lan keo cung se mo panel theo. onPointerDown stopPropagation giu
              nguyen de bam vao day khong lam dnd-kit hieu nham la bat dau keo. */}
          <div className="flex items-start gap-1.5">
            {app.source_url ? (
              <a
                href={app.source_url}
                target="_blank"
                rel="noopener noreferrer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  // PHAI preventDefault. Truoc day chi goi onOpenDetail ma khong
                  // chan hanh vi mac dinh cua the <a>, nen bam vao tieu de vua mo
                  // panel VUA mo tab moi sang tin goc — tab moi cuop focus nen
                  // nguoi dung khong bao gio thay panel. Do duoc tren trinh duyet
                  // that: defaultPrevented = false.
                  //
                  // Chi chan CLICK TRAI THUAN. Ctrl/Cmd/Shift/Alt hoac chuot giua
                  // van mo tin goc o tab moi — do la ky vong voi mot the <a>, va
                  // giu nguyen href cho phep chuot phai "mo o tab moi". Duong toi
                  // tin goc cung con nguyen trong panel ("Xem tin gốc và ứng
                  // tuyển"), nen chan o day khong lam mat loi ra nao.
                  if (!onOpenDetail) return;
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  e.preventDefault();
                  onOpenDetail(app);
                }}
                className="line-clamp-2 cursor-pointer text-sm font-medium text-text hover:text-brand-600"
              >
                {app.title}
              </a>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onOpenDetail?.(app)}
                className="line-clamp-2 cursor-pointer text-left text-sm font-medium text-text hover:text-brand-600"
              >
                {app.title}
              </button>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {[app.company_name, app.city].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className={getSourceBadgeClass(app.source)}>{getSourceLabel(app.source)}</Badge>
            {app.salary_million != null && (
              <span className="font-mono text-xs text-success">~{app.salary_million}M</span>
            )}
            {date && <span className="text-xs text-text-muted">{date}</span>}
          </div>
        </div>

        {!isOverlay && (
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Xoá ${app.title}`}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 {...ICON} className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Xoá khỏi danh sách ứng tuyển?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-text-muted">
                &quot;{app.title}&quot; sẽ bị xoá khỏi tracker (không ảnh hưởng job gốc).
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirming(false)}>
                  Huỷ
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirming(false);
                    onDelete(app.id);
                  }}
                >
                  Xoá
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
