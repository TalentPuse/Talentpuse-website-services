import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const monogramVariants = cva(
  "inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 select-none",
  {
    variants: {
      size: {
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-lg",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type MonogramProps = VariantProps<typeof monogramVariants> & {
  /** Company or user name the initials/hue are derived from. */
  name: string;
  className?: string;
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** Simple deterministic string hash (djb2-ish) mapped onto a 0-359 hue. */
function hashHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/**
 * Monogram — deterministic initials avatar for companies/users when no
 * image is available (job cards, chat, admin tables). The same name always
 * renders the same hue, so recurring entities stay visually recognizable.
 */
export default function Monogram({ name, size, className }: MonogramProps) {
  const initials = getInitials(name);
  const hue = hashHue(name);

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(monogramVariants({ size }), className)}
      style={{ backgroundColor: `hsl(${hue} 60% 45%)` }}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}
