import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSourceLabel } from "@/lib/job-sources";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "@/lib/api";

/** Visual treatment applied to a filter Select trigger once it has an active (non-"all") value. */
const ACTIVE_FILTER_TRIGGER_CLASS =
  "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/30";
const INACTIVE_FILTER_TRIGGER_CLASS = "hover:border-brand-300 hover:bg-surface-2";

type JobFilterBarProps = {
  filters: FilterOptions | null;
  search: string;
  onSearchChange: (value: string) => void;
  city: string;
  onCityChange: (value: string) => void;
  level: string;
  onLevelChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  salary: string;
  onSalaryChange: (value: string) => void;
  /** Total result count from the last successful fetch; null while unknown. */
  resultCount: number | null;
  hasActiveFilters: boolean;
  onReset: () => void;
};

/**
 * JobFilterBar — the single-row (wraps on mobile) search + filter controls
 * for the /jobs board: text search, city/level/source/category/salary
 * selects, a live result count, and a "Xoá bộ lọc" reset action.
 */
export default function JobFilterBar({
  filters,
  search,
  onSearchChange,
  city,
  onCityChange,
  level,
  onLevelChange,
  source,
  onSourceChange,
  category,
  onCategoryChange,
  salary,
  onSalaryChange,
  resultCount,
  hasActiveFilters,
  onReset,
}: JobFilterBarProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      {/* O tim kiem da CHUYEN LEN HERO cua trang (app/jobs/page.tsx). De lai o
          day nua thi mot trang co HAI o tim kiem cung dieu khien mot state — go
          o duoi thi o tren tu doi theo, nhin nhu app bi loi.
          `search` / `onSearchChange` VAN o trong props: chung con duoc dung de
          tinh `hasActiveFilters` va cho nut "Xoa bo loc"; bo prop se buoc sua ca
          call-site ma khong duoc them gi. */}

      <Select value={city} onValueChange={onCityChange}>
        <SelectTrigger
          className={cn(
            "w-auto min-w-36 transition-colors",
            city !== "all" ? ACTIVE_FILTER_TRIGGER_CLASS : INACTIVE_FILTER_TRIGGER_CLASS
          )}
        >
          <SelectValue placeholder="Tất cả thành phố" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả thành phố</SelectItem>
          {filters?.cities.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={level} onValueChange={onLevelChange}>
        <SelectTrigger
          className={cn(
            "w-auto min-w-32 transition-colors",
            level !== "all" ? ACTIVE_FILTER_TRIGGER_CLASS : INACTIVE_FILTER_TRIGGER_CLASS
          )}
        >
          <SelectValue placeholder="Tất cả level" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả level</SelectItem>
          {filters?.levels.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={source} onValueChange={onSourceChange}>
        <SelectTrigger
          className={cn(
            "w-auto min-w-32 transition-colors",
            source !== "all" ? ACTIVE_FILTER_TRIGGER_CLASS : INACTIVE_FILTER_TRIGGER_CLASS
          )}
        >
          <SelectValue placeholder="Tất cả nguồn" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nguồn</SelectItem>
          {filters?.sources.map((s) => (
            <SelectItem key={s} value={s}>
              {getSourceLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={category} onValueChange={onCategoryChange}>
        <SelectTrigger
          className={cn(
            "w-auto min-w-36 transition-colors",
            category !== "all" ? ACTIVE_FILTER_TRIGGER_CLASS : INACTIVE_FILTER_TRIGGER_CLASS
          )}
        >
          <SelectValue placeholder="Tất cả ngành nghề" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả ngành nghề</SelectItem>
          {filters?.categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={salary} onValueChange={onSalaryChange}>
        <SelectTrigger
          className={cn(
            "w-auto min-w-36 transition-colors",
            salary !== "all" ? ACTIVE_FILTER_TRIGGER_CLASS : INACTIVE_FILTER_TRIGGER_CLASS
          )}
        >
          <SelectValue placeholder="Lương: tất cả" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Lương: tất cả</SelectItem>
          <SelectItem value="yes">Có hiển thị lương</SelectItem>
          <SelectItem value="no">Thỏa thuận</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-3">
        {resultCount !== null && (
          <span className="whitespace-nowrap text-sm text-text-muted">
            {resultCount.toLocaleString()} việc làm
          </span>
        )}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-brand-600 hover:text-brand-700"
          >
            Xoá bộ lọc
          </Button>
        )}
      </div>
    </div>
  );
}
