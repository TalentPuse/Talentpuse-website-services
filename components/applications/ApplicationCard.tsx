"use client";
import { useState } from "react";
import { Trash2, ICON } from "@/lib/icons";
import Monogram from "@/components/brand/Monogram";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getSourceLabel, getSourceBadgeClass } from "@/lib/job-sources";
import type { Application, ApplicationStatus } from "@/lib/api";
import StatusSelect from "./StatusSelect";

export default function ApplicationCard({ app, onStatusChange, onDelete }: {
  app: Application; onStatusChange: (id: string, s: ApplicationStatus) => void; onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const date = app.applied_at ? new Date(app.applied_at).toLocaleDateString("vi-VN", { day: "numeric", month: "short" }) : null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
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
      <StatusSelect value={app.status} onChange={(s) => onStatusChange(app.id, s)} />
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
    </div>
  );
}
