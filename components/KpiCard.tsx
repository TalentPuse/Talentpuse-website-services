type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "green" | "amber";
};

const accents = {
  blue: "border-l-brand-500 text-brand-700",
  green: "border-l-emerald-500 text-emerald-700",
  amber: "border-l-amber-500 text-amber-700",
} as const;

export default function KpiCard({ label, value, hint, accent = "blue" }: Props) {
  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-slate-200 border-l-4 p-5 ${accents[accent]}`}
    >
      <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
