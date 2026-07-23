"use client";

import { useDroppable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/api";
import ApplicationCard from "./ApplicationCard";

/** Stage dot — carries the pipeline meaning that colour alone should not. */
const STAGE_DOT: Record<ApplicationStatus, string> = {
  saved: "bg-slate-400",
  applied: "bg-brand-500",
  interviewing: "bg-amber-500",
  offer: "bg-emerald-500",
  rejected: "bg-rose-400",
};

type BoardColumnProps = {
  status: ApplicationStatus;
  label: string;
  apps: Application[];
  onDelete: (id: string) => void;
};

/**
 * BoardColumn — one pipeline stage of the Ứng tuyển board. The column *is* the
 * status: dropping a card here is what changes it, which is why the cards no
 * longer carry a status dropdown.
 *
 * Width: fixed track + horizontal scroll below 2xl (the Trello/Jira/Linear
 * answer for a 5-column board on a narrow screen); from 2xl the columns flex to
 * fill instead, so a wide desktop never shows a scrollbar.
 */
export default function BoardColumn({ status, label, apps, onDelete }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      aria-label={`${label} (${apps.length})`}
      className="flex w-72 shrink-0 snap-start flex-col 2xl:w-auto 2xl:min-w-[260px] 2xl:flex-1 2xl:shrink"
    >
      <header className="mb-2 flex items-center gap-2 px-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", STAGE_DOT[status])} aria-hidden="true" />
        <h2 className="text-[13px] font-semibold tracking-tight text-text">{label}</h2>
        <span className="ml-auto rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-text-muted ring-1 ring-inset ring-border/70">
          {apps.length}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          // min-h-0 lets the column actually scroll instead of growing the page.
          "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl p-2",
          "bg-surface-2/70 ring-1 ring-inset ring-border/50",
          "transition-[background-color,box-shadow] duration-150",
          "[&::-webkit-scrollbar]:w-1.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
          "hover:[&::-webkit-scrollbar-thumb]:bg-text-muted/40",
          isOver && "bg-brand-50 ring-2 ring-brand-400/70",
        )}
      >
        {apps.map((app) => (
          <ApplicationCard key={app.id} app={app} onDelete={onDelete} />
        ))}

        {apps.length === 0 && (
          <div className="m-auto flex w-full select-none items-center justify-center rounded-xl border border-dashed border-border/80 px-2 py-6">
            <p className="text-center text-xs text-text-muted/80">Kéo card vào đây</p>
          </div>
        )}
      </div>
    </section>
  );
}
