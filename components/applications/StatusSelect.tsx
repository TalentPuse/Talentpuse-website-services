"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApplicationStatus } from "@/lib/api";

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Đã lưu", applied: "Đã apply", interviewing: "Phỏng vấn", offer: "Offer", rejected: "Từ chối",
};
export const STATUS_ORDER: ApplicationStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];

export default function StatusSelect({ value, onChange }: { value: ApplicationStatus; onChange: (s: ApplicationStatus) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ApplicationStatus)}>
      <SelectTrigger className="h-8 w-36 text-sm" aria-label="Trạng thái"><SelectValue /></SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
