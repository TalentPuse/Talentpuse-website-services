import GlowCard from "@/components/brand/GlowCard";

export default function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <GlowCard
      className="p-5 shadow-[0_1px_2px_rgb(15_23_42_/_0.04),0_12px_32px_-16px_rgb(15_23_42_/_0.12)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgb(15_23_42_/_0.06),0_20px_40px_-16px_rgb(15_23_42_/_0.18)]"
    >
      <div className="mb-4">
        <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
        )}
      </div>
      {children}
    </GlowCard>
  );
}
