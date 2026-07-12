"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Trash2, ICON } from "@/lib/icons";
import Monogram from "@/components/brand/Monogram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getSourceLabel, getSourceBadgeClass } from "@/lib/job-sources";
import { cn } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/api";
import StatusSelect from "./StatusSelect";

/** How long the post-status-change highlight stays visible before fading out. */
const STATUS_FLASH_MS = 900;

export default function ApplicationCard({ app, onStatusChange, onDelete }: {
  app: Application; onStatusChange: (id: string, s: ApplicationStatus) => void; onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const reduceMotion = useReducedMotion();

  // Pure visual affordance: flash the card's surface briefly whenever `app.status`
  // changes (from either the optimistic update or the follow-up `load()` refresh).
  // Does not touch onStatusChange / the optimistic-update flow in the parent page.
  const prevStatus = useRef(app.status);
  const [justChanged, setJustChanged] = useState(false);
  useEffect(() => {
    if (prevStatus.current === app.status) return;
    prevStatus.current = app.status;
    setJustChanged(true);
    const timer = setTimeout(() => setJustChanged(false), STATUS_FLASH_MS);
    return () => clearTimeout(timer);
  }, [app.status]);

  const date = app.applied_at ? new Date(app.applied_at).toLocaleDateString("vi-VN", { day: "numeric", month: "short" }) : null;
  return (
    <motion.div
      layout={reduceMotion ? false : "position"}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface p-4",
        "transition-[transform,border-color,box-shadow] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
      )}
    >
      <AnimatePresence>
        {justChanged && !reduceMotion && (
          <motion.div
            key="status-flash"
            initial={{ opacity: 0.28 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: STATUS_FLASH_MS / 1000, ease: "easeOut" }}
            className="pointer-events-none absolute inset-0 bg-brand-400"
          />
        )}
      </AnimatePresence>
      <Monogram name={app.company_name || app.title} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {app.source_url
            ? <a href={app.source_url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-text hover:text-brand-600">{app.title}</a>
            : <span className="truncate font-medium text-text">{app.title}</span>}
          <Badge className={getSourceBadgeClass(app.source)}>{getSourceLabel(app.source)}</Badge>
        </div>
        <p className="truncate text-sm text-text-muted">
          {[app.company_name, app.city].filter(Boolean).join(" · ")}
          {app.salary_million != null && <span className="ml-2 font-mono text-success">~{app.salary_million}M</span>}
          {date && <span className="ml-2">· {date}</span>}
        </p>
      </div>
      <motion.div
        animate={justChanged && !reduceMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <StatusSelect value={app.status} onChange={(s) => onStatusChange(app.id, s)} />
      </motion.div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Xoá"><Trash2 {...ICON} className="h-4 w-4" /></Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Xoá khỏi danh sách ứng tuyển?</DialogTitle></DialogHeader>
          <p className="text-sm text-text-muted">&quot;{app.title}&quot; sẽ bị xoá khỏi tracker (không ảnh hưởng job gốc).</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>Huỷ</Button>
            <Button variant="destructive" onClick={() => { setConfirming(false); onDelete(app.id); }}>Xoá</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
