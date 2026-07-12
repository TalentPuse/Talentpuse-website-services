"use client";

/**
 * Facts for GateGuard:
 * - Importer: app/page.tsx (sits above DataStory / "Dữ liệu thị trường").
 * - Purpose: the landing's "wow" AI-native showpiece — a chat window as the
 *   focal point, framed by a breathing gradient border, an aurora backdrop and
 *   floating capability chips. A scripted conversation plays with realistic
 *   typing indicators between turns; the final AI reply types out. Showcases
 *   the flagship "Ứng tuyển" feature as conversational/AI-native.
 * - Data source: none — copy lives in t.aiDemo (lib/landing-i18n.ts), vi + en
 *   parity enforced by the type. NO network. Reduced-motion collapses all the
 *   motion to a static, fully-revealed state.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInView, useReducedMotion } from "framer-motion";

import { ArrowRight, Bell, Bot, Send, Sparkles, Zap } from "@/lib/icons";
import type { LandingCopy } from "@/lib/landing-i18n";

type Props = { t: LandingCopy };

const CARD_TONE = { warn: "bg-amber-500", info: "bg-blue-500" } as const;

const CHIP_ICONS = [Bell, Sparkles, Send, Zap] as const;
const CHIP_POS = [
  "right-full mr-5 top-[14%]",
  "right-full mr-5 top-[60%]",
  "left-full ml-5 top-[26%]",
  "left-full ml-5 top-[70%]",
] as const;

// Conversation timeline (ms → phase). Phases:
// 1 q1 · 2 AI typing · 3 a1 (cards) · 4 q2 · 5 AI typing · 6 a2 types out
const TIMELINE: readonly (readonly [number, number])[] = [
  [300, 1],
  [1000, 2],
  [2100, 3],
  [2700, 4],
  [3300, 5],
  [4300, 6],
];

function TypingDots() {
  return (
    <span className="tp-msg-in inline-flex items-center gap-1 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3.5 shadow-sm">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-text-muted/60 motion-safe:animate-bounce"
          style={{ animationDelay: `${-0.32 + i * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function AiAvatar() {
  return (
    <span className="ai-gradient mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg">
      <Bot className="h-4 w-4 text-white" strokeWidth={2} />
    </span>
  );
}

export default function AiNativeDemo({ t }: Props) {
  const copy = t.aiDemo;
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "-80px" });

  const [phase, setPhase] = useState(0);
  const [typedLen, setTypedLen] = useState(0);
  const typed = copy.a2Typing;

  // Drive the scripted conversation once the demo scrolls into view.
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setPhase(6);
      return;
    }
    const timers = TIMELINE.map(([d, p]) => setTimeout(() => setPhase(p), d));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  // Type the final AI reply out once its turn arrives.
  useEffect(() => {
    if (phase < 6) return;
    if (reduce) {
      setTypedLen(typed.length);
      return;
    }
    setTypedLen(0);
    let i = 0;
    let tk: ReturnType<typeof setTimeout>;
    const run = () => {
      i += 1;
      setTypedLen(i);
      if (i < typed.length) tk = setTimeout(run, 18);
    };
    tk = setTimeout(run, 140);
    return () => clearTimeout(tk);
  }, [phase, reduce, typed]);

  return (
    <section id="ai-demo" className="relative overflow-hidden py-24 sm:py-28">
      {/* aurora backdrop */}
      {!reduce && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="animate-blob-1 absolute left-[14%] top-[6%] h-72 w-72 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--ai-from)" }}
          />
          <div
            className="animate-blob-2 absolute right-[12%] top-[18%] h-80 w-80 rounded-full opacity-30 blur-3xl"
            style={{ background: "var(--ai-to)" }}
          />
          <div
            className="animate-blob-3 absolute bottom-[4%] left-[42%] h-72 w-72 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--color-brand-500)" }}
          />
        </div>
      )}

      <div className="mx-auto max-w-[1600px] px-6">
        <header className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-[clamp(1.75rem,3vw,2.75rem)] font-bold tracking-tight text-text">
            {copy.heading}
          </h2>
          <p className="mt-3 text-text-muted">{copy.sub}</p>
        </header>

        {/* chat window — the focal point, with floating capability chips */}
        <div ref={rootRef} className="relative mx-auto mt-14 max-w-5xl">
          {copy.chips.map((chip, i) => {
            const Icon = CHIP_ICONS[i % CHIP_ICONS.length];
            return (
              <div
                key={chip}
                className={`absolute z-20 hidden items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-text shadow-lg backdrop-blur 2xl:flex ${CHIP_POS[i]} ${
                  reduce ? "" : "tp-msg-in"
                }`}
                style={reduce ? undefined : { animationDelay: `${0.4 + i * 0.15}s` }}
              >
                <Icon className="h-3.5 w-3.5 text-brand-600" strokeWidth={2} />
                {chip}
              </div>
            );
          })}

          {/* breathing glow + gradient border + glass card */}
          <div className={`relative rounded-[26px] ${reduce ? "" : "glow-brand"}`}>
            <div className="ai-gradient rounded-[26px] p-[1.5px] shadow-2xl shadow-brand-900/10">
              <div className="overflow-hidden rounded-[25px] bg-surface/95 backdrop-blur-xl">
                {/* header */}
                <div className="flex items-center gap-3 border-b border-border bg-surface-2/60 px-5 py-3.5">
                  <span className="ai-gradient grid h-9 w-9 place-items-center rounded-xl">
                    <Bot className="h-5 w-5 text-white" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{copy.windowTitle}</p>
                    <p className="text-xs text-text-muted">{copy.windowSubtitle}</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                    Online
                  </span>
                </div>

                {/* conversation */}
                <div className="min-h-[26rem] space-y-4 bg-gradient-to-b from-surface-2/25 to-transparent px-4 py-6 sm:px-6">
                  {/* user question */}
                  {phase >= 1 && (
                    <div className="tp-msg-in flex justify-end">
                      <p className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">
                        {copy.q1}
                      </p>
                    </div>
                  )}

                  {/* AI answer (with typing indicator first) */}
                  {phase === 2 && (
                    <div className="flex gap-2.5">
                      <AiAvatar />
                      <TypingDots />
                    </div>
                  )}
                  {phase >= 3 && (
                    <div className="tp-msg-in flex gap-2.5">
                      <AiAvatar />
                      <div className="max-w-[82%] rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 shadow-sm">
                        <p className="text-sm leading-relaxed text-text">{copy.a1Intro}</p>
                        <div className="mt-2.5 space-y-1.5">
                          {copy.cards.map((card) => (
                            <div
                              key={card.company}
                              className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2/50 px-2.5 py-2"
                            >
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-xs font-semibold text-text-muted">
                                {card.company.charAt(0)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-text">{card.role}</p>
                                <p className="truncate text-[11px] text-text-muted">{card.company}</p>
                              </div>
                              <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-muted">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${CARD_TONE[card.tone as keyof typeof CARD_TONE]}`}
                                />
                                {card.note}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* user follow-up */}
                  {phase >= 4 && (
                    <div className="tp-msg-in flex justify-end">
                      <p className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-600 px-4 py-2.5 text-sm text-white shadow-sm">
                        {copy.q2}
                      </p>
                    </div>
                  )}

                  {/* AI final reply (typing indicator, then types out) */}
                  {phase === 5 && (
                    <div className="flex gap-2.5">
                      <AiAvatar />
                      <TypingDots />
                    </div>
                  )}
                  {phase >= 6 && (
                    <div className="tp-msg-in flex gap-2.5">
                      <AiAvatar />
                      <p className="min-h-[3rem] max-w-[82%] rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-text shadow-sm">
                        {typed.slice(0, typedLen)}
                        {!reduce && typedLen < typed.length && <span className="tp-caret" />}
                      </p>
                    </div>
                  )}
                </div>

                {/* input bar (demo) */}
                <div className="flex items-center gap-2 border-t border-border bg-surface px-3 py-3">
                  <div className="flex-1 truncate rounded-full border border-border bg-surface-2/60 px-4 py-2 text-sm text-text-muted">
                    {copy.inputPlaceholder}
                  </div>
                  <span aria-hidden className="ai-gradient grid h-9 w-9 shrink-0 place-items-center rounded-full">
                    <Send className="h-4 w-4 text-white" strokeWidth={2} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-center">
            <Link
              href="/assistant"
              className="group inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:scale-[1.02] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {copy.cta}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
