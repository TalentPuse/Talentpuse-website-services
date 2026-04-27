import type { CompanyRow } from "@/lib/api";

export default function CompaniesTable({ data }: { data: CompanyRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-slate-200 text-slate-600 uppercase text-xs">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Company</th>
            <th className="px-3 py-2 font-medium text-right">Jobs</th>
            <th className="px-3 py-2 font-medium">City</th>
            <th className="px-3 py-2 font-medium text-right">Avg views</th>
            <th className="px-3 py-2 font-medium text-right">Avg salary</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.company_name}
              className="border-b border-slate-100 hover:bg-slate-50"
            >
              <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
              <td className="px-3 py-2 font-medium text-slate-800">
                {row.company_name}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.n_jobs}</td>
              <td className="px-3 py-2 text-slate-600">
                {row.primary_city || "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                {row.avg_views ? Math.round(row.avg_views).toLocaleString() : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {row.avg_salary_million ? `${row.avg_salary_million}M` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
