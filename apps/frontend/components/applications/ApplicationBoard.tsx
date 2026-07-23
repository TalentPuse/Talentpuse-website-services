"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import type { Application, ApplicationStatus } from "@/lib/api";
import ApplicationCard from "./ApplicationCard";
import BoardColumn from "./BoardColumn";
import { STATUS_LABEL, STATUS_ORDER } from "./StatusSelect";

type ApplicationBoardProps = {
  apps: Application[];
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onDelete: (id: string) => void;
};

/**
 * ApplicationBoard — the Ứng tuyển pipeline as a Trello-style board.
 *
 * Columns are the five statuses in pipeline order; dropping a card on a column
 * is the status change (the parent persists it optimistically). Cards are NOT
 * sortable within a column — `app.job_applications` has no position column, so
 * ordering stays `created_at desc` as it comes from the API.
 */
export default function ApplicationBoard({ apps, onStatusChange, onDelete }: ApplicationBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    // 5px of travel before a drag starts, so clicking the card's link or its
    // delete button still behaves like a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(
      STATUS_ORDER.map((s) => [s, [] as Application[]]),
    ) as Record<ApplicationStatus, Application[]>;
    for (const app of apps) {
      // Guard against a status the UI does not model rather than dropping the row.
      if (groups[app.status as ApplicationStatus]) groups[app.status as ApplicationStatus].push(app);
    }
    return groups;
  }, [apps]);

  const activeApp = activeId ? apps.find((a) => a.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const next = over.id as ApplicationStatus;
    const app = apps.find((a) => a.id === String(active.id));
    if (!app || app.status === next) return;

    onStatusChange(app.id, next);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {/* Fixed-width tracks + horizontal scroll; from 2xl the columns flex to fill
          but never below 260px. `2xl:overflow-x-visible` bị bỏ vì với dock 380px
          mở ra, ngay cả màn 1920 cũng chỉ còn ~1250px cho 5 cột — flex tự do sẽ
          bóp cột xuống ~236px, tên job xuống 3 dòng. Giữ min-width rồi cho cuộn
          là đánh đổi đúng: thà cuộn ngang còn hơn vỡ card. */}
      <div
        className={cn(
          "flex h-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2",
          "[&::-webkit-scrollbar]:h-1.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
          "hover:[&::-webkit-scrollbar-thumb]:bg-text-muted/40",
        )}
      >
        {STATUS_ORDER.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            label={STATUS_LABEL[status]}
            apps={byStatus[status]}
            onDelete={onDelete}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeApp ? <ApplicationCard app={activeApp} onDelete={onDelete} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
