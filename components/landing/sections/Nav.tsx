"use client";

import Link from "next/link";

import { Sparkles } from "@/lib/icons";
import { translations, type Lang } from "@/lib/landing-i18n";
import { cn } from "@/lib/utils";

type Dict = (typeof translations)["vi"];

type Props = {
  t: Dict;
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const LANGS: Lang[] = ["vi", "en"];

export default function Nav({ t, lang, setLang }: Props) {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="TalentPulse">
          <span className="ai-gradient grid h-8 w-8 place-items-center rounded-lg text-white shadow-sm">
            <Sparkles size={18} strokeWidth={2} />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-text">
            Talent<span className="ai-text">Pulse</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs font-medium"
            role="group"
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={cn(
                  "rounded-md px-2.5 py-1 uppercase transition-colors",
                  lang === l
                    ? "bg-surface-2 text-text shadow-sm"
                    : "text-text-muted hover:text-text"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <a
            href="#ai-alert"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:block"
          >
            {t.nav.features}
          </a>
          <Link
            href="/signin"
            className="hidden text-sm text-text-muted transition-colors hover:text-text sm:block"
          >
            {t.nav.signIn}
          </Link>
          <Link
            href="/signup"
            className="ai-gradient rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] hover:brightness-110"
          >
            {t.nav.signUp}
          </Link>
        </div>
      </div>
    </nav>
  );
}
