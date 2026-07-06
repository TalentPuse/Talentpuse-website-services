"use client";

import { Banknote, ExternalLink } from "lucide-react";
import { Building2, MapPin } from "@/lib/icons";
import type { AlertCardData } from "@/lib/chat-types";

const SOURCE_LABEL: Record<string, string> = {
  vietnamworks: "VietnamWorks",
  itviec: "ITviec",
};

export default function AlertCard({
  alert,
  index,
}: {
  alert: AlertCardData;
  index: number;
}) {
  return (
    <div className="py-2.5 border-b border-border last:border-0">
      <div className="flex items-start gap-2">
        <span className="text-xs font-bold text-text-muted mt-0.5 shrink-0">
          {index}.
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text leading-snug">
            {alert.title || "Chưa có tiêu đề"}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-text-muted">
            {alert.company_name && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" strokeWidth={2} />
                {alert.company_name}
              </span>
            )}
            {alert.city_canonical && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" strokeWidth={2} />
                {alert.city_canonical}
              </span>
            )}
            {alert.salary_million && (
              <span className="flex items-center gap-1 text-success font-medium">
                <Banknote className="w-3 h-3" strokeWidth={2} />
                ~{alert.salary_million.toFixed(0)}M
              </span>
            )}
          </div>
          {alert.source_url && (
            <a
              href={alert.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
            >
              Xem trên {alert.source ? SOURCE_LABEL[alert.source] || alert.source : "nguồn"}
              <ExternalLink className="w-3 h-3" strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
