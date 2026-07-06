import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Monogram from "@/components/brand/Monogram";
import { MapPin } from "@/lib/icons";
import type { CompanyRow } from "@/lib/api";

export default function CompaniesTable({ data }: { data: CompanyRow[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-muted">
        Không có dữ liệu công ty phù hợp.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Company</TableHead>
          <TableHead className="text-right">Jobs</TableHead>
          <TableHead>City</TableHead>
          <TableHead className="text-right">Avg views</TableHead>
          <TableHead className="text-right">Avg salary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row, idx) => (
          <TableRow key={row.company_name}>
            <TableCell className="font-mono text-text-muted">{idx + 1}</TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Monogram name={row.company_name} size="sm" />
                <span className="font-medium text-text">{row.company_name}</span>
              </div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-text">
              {row.n_jobs}
            </TableCell>
            <TableCell className="text-text-muted">
              {row.primary_city ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} strokeWidth={1.75} className="shrink-0 text-text-muted" />
                  {row.primary_city}
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-text-muted">
              {row.avg_views ? Math.round(row.avg_views).toLocaleString() : "—"}
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums text-text">
              {row.avg_salary_million ? `${row.avg_salary_million}M` : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
