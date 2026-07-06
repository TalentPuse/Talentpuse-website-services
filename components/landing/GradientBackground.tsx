"use client";

import Aurora from "@/components/brand/Aurora";

/**
 * GradientBackground — dark hero ambience for the landing page.
 *
 * Thin wrapper over the brand <Aurora/> primitive (compositor-safe radial
 * glow, animates only `transform`/`filter`) layered under a soft top-down
 * spotlight and a masked grid texture. Purely decorative and hidden from
 * assistive tech. Drop it into a `relative` dark section; it fills that
 * section via `absolute inset-0` and sits behind content on `-z-10`.
 */
export default function GradientBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      {/* top-down spotlight */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 50% -5%, color-mix(in oklch, var(--ai-from) 24%, transparent), transparent 70%)",
        }}
      />
      <Aurora />
      {/* faint blueprint grid, masked to a soft center vignette */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "radial-gradient(70% 55% at 50% 25%, black, transparent 80%)",
          WebkitMaskImage: "radial-gradient(70% 55% at 50% 25%, black, transparent 80%)",
        }}
      />
    </div>
  );
}
