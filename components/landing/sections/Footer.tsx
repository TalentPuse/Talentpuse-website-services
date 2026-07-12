"use client";

/**
 * Footer — site footer with product/resources/legal/connect link columns.
 * Importer: app/page.tsx (rendered last, outside <main>). Data source: i18n
 * only (t.footer.*) — no network calls. The literal "TalentPuse" (missing
 * the 'l') string below appears ONLY inside the Telegram href URL, per the
 * existing bot handle — it must never appear in visible text.
 */

import Link from "next/link";

import { Mail, Send, Sparkles } from "@/lib/icons";
import type { LandingCopy } from "@/lib/landing-i18n";

export default function Footer({ t }: { t: LandingCopy }) {
  return (
    <footer className="border-t border-border bg-bg text-text-muted">
      <div className="mx-auto max-w-[1600px] px-6 py-14">
        <div className="flex flex-col justify-between gap-10 lg:flex-row">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="inline-flex items-center gap-2.5">
              <span className="ai-gradient grid h-8 w-8 place-items-center rounded-lg text-white">
                <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-text">
                Talent<span className="text-brand-600">Puse</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">{t.footer.tagline}</p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4 sm:gap-10">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text">
                {t.footer.product}
              </span>
              <Link href="/dashboard" className="transition-colors hover:text-text">
                {t.footer.links.dashboard}
              </Link>
              <Link href="/jobs" className="transition-colors hover:text-text">
                {t.footer.links.jobs}
              </Link>
              <Link href="/assistant" className="transition-colors hover:text-text">
                {t.footer.links.assistant}
              </Link>
              <Link href="/interview" className="transition-colors hover:text-text">
                {t.footer.links.interview}
              </Link>
              <Link href="/applications" className="transition-colors hover:text-text">
                {t.footer.links.tracker}
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text">
                {t.footer.resources}
              </span>
              <a href="#faq" className="transition-colors hover:text-text">
                {t.footer.links.faq}
              </a>
              <a href="#ai-demo" className="transition-colors hover:text-text">
                {t.footer.links.pipeline}
              </a>
              <a href="#data" className="transition-colors hover:text-text">
                {t.footer.links.data}
              </a>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text">
                {t.footer.legal}
              </span>
              <Link href="/privacy" className="transition-colors hover:text-text">
                {t.footer.links.privacy}
              </Link>
              <Link href="/terms" className="transition-colors hover:text-text">
                {t.footer.links.terms}
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text">
                {t.footer.connect}
              </span>
              <a
                href="https://t.me/TalentPuseBot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-text"
              >
                <Send className="h-[15px] w-[15px]" strokeWidth={1.75} />
                {t.footer.links.telegram}
              </a>
              <a
                href="mailto:baonm@talentpuse.io.vn"
                className="inline-flex items-center gap-2 transition-colors hover:text-text"
              >
                <Mail className="h-[15px] w-[15px]" strokeWidth={1.75} />
                baonm@talentpuse.io.vn
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-xs text-text-muted">
          {t.footer.copyright}
        </div>
      </div>
    </footer>
  );
}
