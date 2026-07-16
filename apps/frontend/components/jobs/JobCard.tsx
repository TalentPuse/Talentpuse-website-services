import { ExternalLink } from "lucide-react";

import GlowCard from "@/components/brand/GlowCard";
import Monogram from "@/components/brand/Monogram";
import CaptureButton from "@/components/applications/CaptureButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase } from "@/lib/icons";
import { getSourceBadgeClass, getSourceLabel } from "@/lib/job-sources";
import { cn } from "@/lib/utils";
import type { PublicJobRow, TrackedKey } from "@/lib/api";

const VISIBLE_SKILL_COUNT = 5;

type JobCardProps = {
  job: PublicJobRow;
  tracked?: TrackedKey | null;
  onTracked?: (entry: TrackedKey) => void;
};

/**
 * JobCard — a single job listing tile for the /jobs board: company monogram,
 * title/company, source badge, city/level meta row, salary badge, skill
 * chips, and an external "Xem chi tiết" CTA + "Đã apply" capture button.
 */
export default function JobCard({ job, tracked, onTracked }: JobCardProps) {
  const sourceLabel = getSourceLabel(job.source);
  const sourceBadgeClass = getSourceBadgeClass(job.source);
  const postedDate = job.posted_at
    ? new Date(job.posted_at).toLocaleDateString("vi-VN", { day: "numeric", month: "short" })
    : null;
  const visibleSkills = job.skills.slice(0, VISIBLE_SKILL_COUNT);
  const extraSkillCount = job.skills.length - visibleSkills.length;

  return (
    <GlowCard className="group h-full p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-900/5">
      <div className="mb-3 flex items-start gap-3">
        <Monogram name={job.company_name || job.title || "?"} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-text line-clamp-2 transition-colors group-hover:text-brand-700">
            {job.title || "Chưa có tiêu đề"}
          </h3>
          <p className="mt-0.5 truncate text-sm text-text-muted">
            {job.company_name || "Chưa rõ công ty"}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
            sourceBadgeClass
          )}
        >
          {sourceLabel}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-muted">
        {job.city_canonical && (
          <span className="flex items-center gap-1">
            <MapPin size={14} strokeWidth={1.75} />
            {job.city_canonical}
          </span>
        )}
        {job.job_level && (
          <span className="flex items-center gap-1">
            <Briefcase size={14} strokeWidth={1.75} />
            {job.job_level}
          </span>
        )}
        {postedDate && <span className="text-xs text-text-muted/70">{postedDate}</span>}
      </div>

      <div className="mb-4">
        {job.salary_million ? (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 font-mono text-emerald-700"
          >
            ~{job.salary_million.toFixed(0)} triệu
          </Badge>
        ) : (
          <Badge variant="outline" className="text-text-muted">
            Thỏa thuận
          </Badge>
        )}
      </div>

      {visibleSkills.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {visibleSkills.map((skill) => (
            <span
              key={skill}
              className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
            >
              {skill}
            </span>
          ))}
          {extraSkillCount > 0 && (
            <span
              className="inline-block rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-muted"
              title={job.skills.join(", ")}
            >
              +{extraSkillCount}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {job.source_url ? (
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={job.source_url} target="_blank" rel="noopener noreferrer">
              Xem chi tiết
              <ExternalLink size={14} strokeWidth={2} />
            </a>
          </Button>
        ) : (
          <span className="text-xs text-text-muted">Chưa có link</span>
        )}
        <CaptureButton
          source={job.source}
          sourceJobId={job.source_job_id}
          tracked={tracked}
          onTracked={onTracked}
        />
      </div>
    </GlowCard>
  );
}
