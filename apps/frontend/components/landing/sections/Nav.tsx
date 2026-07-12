"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import type { LandingCopy, Lang } from "@/lib/landing-i18n";
import { cn } from "@/lib/utils";

type Props = {
  t: LandingCopy;
  lang: Lang;
  setLang: (l: Lang) => void;
};

const LANGS: Lang[] = ["vi", "en"];

export default function Nav({ t, lang, setLang }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks: { href: string; label: string }[] = [
    { href: "#features", label: t.nav.features },
    { href: "#data", label: t.nav.data },
    { href: "#ai-demo", label: t.nav.pipeline },
    { href: "#students", label: t.nav.students },
    { href: "#faq", label: t.nav.faq },
  ];

  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled
          ? "border-border bg-bg/80 backdrop-blur-xl shadow-sm shadow-black/5"
          : "border-transparent bg-bg/40 backdrop-blur-sm"
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
        {/* Brand */}
        <Link href="/" className="inline-flex items-center" aria-label="TalentPuse">
          {/* logo.png is a square lockup with padding + tagline; crop to the wordmark band */}
          <div className="relative h-9 w-[186px] overflow-hidden">
            <Image
              src="/logo.png"
              alt="TalentPuse"
              fill
              priority
              sizes="186px"
              className="object-cover"
              style={{ objectPosition: "center 44%" }}
            />
          </div>
        </Link>

        {/* Section anchors */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => handleNavClick(event, link.href)}
              className="text-sm text-text-muted transition-colors hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Language + auth */}
        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Language"
            className="flex items-center rounded-full border border-border bg-surface p-0.5 text-xs font-medium"
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                aria-label={l === "vi" ? "Tiếng Việt" : "English"}
                className={cn(
                  "rounded-full px-2.5 py-1 uppercase transition-colors",
                  lang === l ? "bg-brand-600 text-white" : "text-text-muted hover:text-text"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <Link
            href="/signin"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:block"
          >
            {t.nav.signIn}
          </Link>

          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:brightness-110"
          >
            {t.nav.signUp}
          </Link>
        </div>
      </div>
    </nav>
  );
}
