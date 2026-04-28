type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "green" | "amber";
};

const styles = {
  blue: "from-brand-50 via-white to-white border-brand-100 before:from-brand-500 before:to-brand-400 text-brand-700",
  green: "from-emerald-50 via-white to-white border-emerald-100 before:from-emerald-500 before:to-emerald-400 text-emerald-700",
  amber: "from-amber-50 via-white to-white border-amber-100 before:from-amber-500 before:to-amber-400 text-amber-700",
} as const;

export default function KpiCard({ label, value, hint, accent = "blue" }: Props) {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br rounded-xl shadow-sm border p-5 before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-1 before:bg-gradient-to-r before:rounded-t-xl ${styles[accent]}`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
