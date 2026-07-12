"use client";

/**
 * CareerJourney — a warm human band of 3 real photos mapping to the hero arc
 * "Từ tìm việc đến nhận offer". Importer: app/page.tsx. Images are local,
 * free-license (Unsplash) files under public/img — no runtime network.
 */

import Image from "next/image";

import ScrollReveal from "@/components/landing/ScrollReveal";
import type { Lang } from "@/lib/landing-i18n";

const COPY: Record<Lang, { heading: string; sub: string; items: string[] }> = {
  vi: {
    heading: "Hành trình sự nghiệp, có TalentPuse đồng hành",
    sub: "Từ những dòng code đầu tiên đến cái bắt tay nhận offer.",
    items: ["Tìm việc & làm việc", "Phỏng vấn tự tin", "Nhận offer"],
  },
  en: {
    heading: "Your career journey, with TalentPuse",
    sub: "From your first lines of code to the offer handshake.",
    items: ["Find work & build", "Interview with confidence", "Land the offer"],
  },
};

const IMAGES = ["/img/c1.jpg", "/img/c4.jpg", "/img/c2.jpg"];

export default function CareerJourney({ lang }: { lang: Lang }) {
  const copy = COPY[lang];

  return (
    <section className="mx-auto max-w-[1600px] px-6 py-24 sm:py-28">
      <ScrollReveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-bold tracking-tight text-text">
            {copy.heading}
          </h2>
          <p className="mt-4 text-lg text-text-muted">{copy.sub}</p>
        </div>
      </ScrollReveal>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {IMAGES.map((src, i) => (
          <ScrollReveal key={src} delay={i * 0.1}>
            <figure className="group relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] border border-border shadow-sm">
              <Image
                src={src}
                alt={copy.items[i]}
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4">
                <span className="font-mono text-xs text-white/80">0{i + 1}</span>
                <span className="font-display text-base font-semibold text-white">{copy.items[i]}</span>
              </figcaption>
            </figure>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
