"use client";

import Link from "next/link";

import { Mail, Send, Sparkles } from "@/lib/icons";
import { translations } from "@/lib/landing-i18n";

type Dict = (typeof translations)["vi"];

export default function Footer({ t }: { t: Dict }) {
  return (
    <footer className="border-t border-border bg-bg text-text-muted">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="flex max-w-xs flex-col gap-3">
            <div className="inline-flex items-center gap-2.5">
              <span className="ai-gradient grid h-8 w-8 place-items-center rounded-lg text-white">
                <Sparkles size={18} strokeWidth={2} />
              </span>
              <span className="font-display text-lg font-semibold tracking-tight text-text">
                Talent<span className="ai-text">Pulse</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed">{t.footer.tagline}</p>
          </div>

          <div className="flex gap-16 text-sm">
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text">
                {t.footer.product}
              </span>
              <Link href="/dashboard" className="transition-colors hover:text-text">
                {t.footer.dashboard}
              </Link>
              <a href="#ai-alert" className="transition-colors hover:text-text">
                {t.footer.features}
              </a>
              <Link href="/signup" className="transition-colors hover:text-text">
                {t.footer.signUp}
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
                <Send size={15} strokeWidth={1.75} />
                Telegram Bot
              </a>
              <a
                href="mailto:baonm@talentpuse.io.vn"
                className="inline-flex items-center gap-2 transition-colors hover:text-text"
              >
                <Mail size={15} strokeWidth={1.75} />
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
