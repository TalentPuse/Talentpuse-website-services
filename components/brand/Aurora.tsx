import { cn } from "@/lib/utils";

type AuroraProps = {
  className?: string;
};

/**
 * Aurora — decorative, absolutely-positioned blurred radial glow blobs.
 * Built for dark surfaces (hero sections, feature panels): compositor-safe,
 * animating only `transform` (via the existing `blob-float` keyframe) and
 * `filter: blur`. Purely decorative — non-interactive and hidden from
 * assistive tech.
 *
 * Place inside a `relative overflow-hidden` container that has a dark
 * background; Aurora fills that container via `absolute inset-0`.
 */
export default function Aurora({ className }: AuroraProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div
        className="animate-blob-1 absolute -top-24 -left-20 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ backgroundColor: "var(--ai-from)" }}
      />
      <div
        className="animate-blob-2 absolute top-1/4 -right-24 h-[26rem] w-[26rem] rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: "var(--ai-to)" }}
      />
      <div
        className="animate-blob-3 absolute -bottom-28 left-1/4 h-80 w-80 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: "var(--brand)" }}
      />
    </div>
  );
}
