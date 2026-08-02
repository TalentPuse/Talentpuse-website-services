"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

import type { MyAlertRow, TrackedKey } from "@/lib/api";
import Monogram from "@/components/brand/Monogram";
import CaptureButton from "@/components/applications/CaptureButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Inbox, Mail, Send, ArrowRight, ICON } from "@/lib/icons";
import { getCityLabel } from "@/lib/city-labels";
import { cn } from "@/lib/utils";

type AlertTimelineProps = {
  alerts: MyAlertRow[];
  isLoading: boolean;
  trackedKeys?: Map<string, TrackedKey>;
  onTracked?: (entry: TrackedKey) => void;
};

type DateGroup = {
  key: string;
  heading: string;
  items: MyAlertRow[];
};

const WEEKDAYS_VI = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];

function formatDateHeading(date: Date): string {
  const weekday = WEEKDAYS_VI[date.getDay()];
  return `${weekday}, ${date.getDate()} tháng ${date.getMonth() + 1}`;
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupAlertsByDate(alerts: MyAlertRow[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const alert of alerts) {
    const sentDate = new Date(alert.sent_at);
    const key = dateKey(sentDate);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(alert);
    } else {
      groups.set(key, { key, heading: formatDateHeading(sentDate), items: [alert] });
    }
  }
  return Array.from(groups.values());
}

/**
 * Một badge cho MỖI kênh alert thực sự được gửi qua.
 *
 * Bản cũ nhận một chuỗi `channel` và suy ra "không phải telegram ⇒ email" —
 * nên dòng `website` (dấu mốc dedup, không phải kênh gửi) hiện thành icon thư
 * kèm tooltip "Gửi qua Email". Vì email là opt-in thuần tuý và ít người bật,
 * gần như MỌI dòng trong Lịch sử Alert đều mang nhãn sai (JA-54).
 *
 * Danh sách rỗng nghĩa là chưa gửi được qua kênh nào — phải nói thẳng như vậy
 * thay vì im lặng bịa ra một kênh.
 */
function ChannelBadges({ channels }: { channels: string[] }) {
  if (!channels.length) {
    return (
      <span
        role="img"
        aria-label="Chưa gửi qua kênh nào"
        title="Chưa gửi qua kênh nào"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-border/50 text-text-muted"
      >
        <Inbox size={12} strokeWidth={2} aria-hidden="true" />
      </span>
    );
  }

  return (
    <>
      {channels.map((channel) => {
        const isTelegram = channel === "telegram";
        const Icon = isTelegram ? Send : Mail;
        const label = isTelegram ? "Gửi qua Telegram" : "Gửi qua Email";

        return (
          <span
            key={channel}
            role="img"
            aria-label={label}
            title={label}
            className={cn(
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              isTelegram ? "bg-brand-100 text-brand-600" : "bg-warning/15 text-warning"
            )}
          >
            <Icon size={12} strokeWidth={2} aria-hidden="true" />
          </span>
        );
      })}
    </>
  );
}

function AlertTimelineItem({
  alert,
  tracked,
  onTracked,
  isNewest,
}: {
  alert: MyAlertRow;
  tracked?: TrackedKey | null;
  onTracked?: (entry: TrackedKey) => void;
  isNewest?: boolean;
}) {
  const sentDate = new Date(alert.sent_at);
  const monogramName = alert.company_name || alert.title || "Không rõ";
  const shouldReduceMotion = useReducedMotion();

  return (
    <li className="relative pl-8">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-[7px] top-5 -translate-x-1/2 rounded-full border-2 border-bg bg-brand",
          isNewest ? "h-3 w-3" : "h-2.5 w-2.5",
          isNewest && !shouldReduceMotion && "glow-brand"
        )}
      />
      <div
        className={cn(
          "flex items-start gap-3 rounded-[var(--radius-md)] border bg-surface p-3 transition-colors hover:bg-surface-2",
          isNewest ? "border-brand-300/70 ring-1 ring-brand-200/60" : "border-border"
        )}
      >
        <Monogram name={monogramName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {alert.source_url ? (
              <a
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-1 font-medium text-text hover:text-brand hover:underline"
              >
                {alert.title || "—"}
              </a>
            ) : (
              <p className="line-clamp-1 font-medium text-text">{alert.title || "—"}</p>
            )}
            {isNewest && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Mới nhất
              </span>
            )}
            {/*
              Tin hết hạn giờ VẪN hiện đầy đủ tiêu đề/công ty, chỉ kèm dấu này.
              Trước đây API lọc `f.is_active` ngay trong điều kiện JOIN nên alert
              của tin đã hết hạn render thành dòng trắng "—" — người dùng không
              biết đó là job gì, cũng không mở được (JA-31).
            */}
            {!alert.is_active && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                Đã hết hạn
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">
            {alert.company_name || "—"}
            {/*
              Dùng nhãn hiển thị, không phải mã canonical của warehouse. Trang
              /jobs đã đổi "HCMC" → "Hồ Chí Minh" nhưng trang này thì chưa, nên
              cùng một thành phố hiện hai kiểu ở hai màn hình cạnh nhau.
            */}
            {alert.city_canonical ? ` · ${getCityLabel(alert.city_canonical)}` : ""}
          </p>
          <div className="mt-2">
            {alert.source ? (
              <CaptureButton
                source={alert.source}
                sourceJobId={alert.source_job_id}
                tracked={tracked}
                onTracked={onTracked}
              />
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {alert.salary_million ? (
            <span className="font-mono text-sm font-medium text-success">
              ~{alert.salary_million.toFixed(0)}M
            </span>
          ) : (
            <span className="font-mono text-sm text-text-muted">—</span>
          )}
          <div className="flex items-center gap-1.5">
            <ChannelBadges channels={alert.channels} />
            <span className="font-mono text-xs text-text-muted">{formatTime(sentDate)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function TimelineLoadingSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      {[0, 1].map((groupIdx) => (
        <div key={groupIdx}>
          <Skeleton className="mb-3 h-4 w-40" />
          <div className="space-y-3">
            {[0, 1, 2].map((rowIdx) => (
              <div
                key={rowIdx}
                className="ml-8 flex items-center gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-3"
              >
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-4 w-12 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineEmptyState() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-surface-2/50 px-6 py-16 text-center"
    >
      <span className="ai-glow flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Bell {...ICON} aria-hidden="true" />
      </span>
      <p className="font-display text-lg font-medium text-text">Chưa có alert nào</p>
      <p className="max-w-sm text-sm text-text-muted">
        Khi có công việc phù hợp với tiêu chí của bạn, alert sẽ xuất hiện tại đây theo thời gian
        thực qua Telegram hoặc Email.
      </p>
      <Button asChild size="sm" className="mt-1 gap-1.5">
        <Link href="/profile#alerts">
          Thiết lập tiêu chí alert
          <ArrowRight size={14} strokeWidth={2} />
        </Link>
      </Button>
    </motion.div>
  );
}

/**
 * AlertTimeline — renders `myAlerts` rows as a date-grouped timeline
 * (sticky date heading + vertical line with dot markers), replacing the
 * previous raw `<table>`. Handles its own loading (skeleton) and empty
 * (designed) states so the page only wires data + pagination.
 */
export default function AlertTimeline({ alerts, isLoading, trackedKeys, onTracked }: AlertTimelineProps) {
  if (isLoading) {
    return <TimelineLoadingSkeleton />;
  }

  if (alerts.length === 0) {
    return <TimelineEmptyState />;
  }

  const groups = groupAlertsByDate(alerts);
  const newestKey = groups[0]?.items[0]
    ? `${groups[0].items[0].source_job_id}-${groups[0].items[0].sent_at}`
    : null;

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <motion.section
          key={group.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <h2 className="sticky top-0 z-10 mb-3 bg-bg/85 py-1.5 font-display text-sm font-semibold capitalize text-text backdrop-blur">
            {group.heading}
          </h2>
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[7px] top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-brand-200 via-border to-border"
            />
            <ul className="space-y-3">
              {group.items.map((alert) => {
                const itemKey = `${alert.source_job_id}-${alert.sent_at}`;
                return (
                  <AlertTimelineItem
                    key={itemKey}
                    alert={alert}
                    tracked={trackedKeys?.get(`${alert.source ?? ""}:${alert.source_job_id}`) ?? null}
                    onTracked={onTracked}
                    isNewest={itemKey === newestKey}
                  />
                );
              })}
            </ul>
          </div>
        </motion.section>
      ))}
    </div>
  );
}
