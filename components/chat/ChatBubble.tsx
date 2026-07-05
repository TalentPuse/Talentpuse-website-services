"use client";

import { useState } from "react";
import type { ChatMessage } from "@/lib/chat-types";

/** Lightweight markdown → HTML for assistant messages */
function renderMarkdown(md: string, streaming?: boolean): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="bg-slate-900 text-slate-100 rounded-xl p-3.5 my-3 overflow-x-auto text-[13px] leading-relaxed"><code>${code.trim()}</code></pre>`,
  );
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-brand-700 px-1.5 py-0.5 rounded-sm text-[13px]">$1</code>');

  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/g,
    (_m, headerRow: string, _sep: string, bodyRows: string) => {
      const parseCells = (row: string) => row.split("|").filter((c) => c.trim()).map((c) => c.trim());
      const headers = parseCells(headerRow);
      const rows = bodyRows.trim().split("\n").filter((r) => r.includes("|")).map(parseCells);
      return (
        `<div class="my-3 overflow-x-auto rounded-xl border border-slate-200"><table class="w-full text-[13px] border-collapse"><thead><tr>` +
        headers.map((h) => `<th class="border-b border-slate-200 px-3 py-2 bg-slate-50 text-left font-semibold text-slate-700">${h}</th>`).join("") +
        `</tr></thead><tbody>` +
        rows.map((cells) => `<tr>${cells.map((c) => `<td class="border-b border-slate-100 px-3 py-2 text-slate-600">${c}</td>`).join("")}</tr>`).join("") +
        `</tbody></table></div>`
      );
    },
  );

  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-[15px] font-semibold text-slate-900 mt-4 mb-1.5">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-slate-900 mt-4 mb-1.5">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-900 mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-900 mt-5 mb-2">$1</h1>');
  html = html.replace(/^---+$/gm, '<hr class="my-4 border-slate-200" />');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li class="ml-1">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-2 space-y-1 list-disc pl-5 marker:text-slate-300">$1</ul>');
  html = html.replace(/\n{2,}/g, "</p><p class='my-2.5'>");
  html = html.replace(/\n/g, "<br />");
  const caret = streaming ? '<span class="tp-caret"></span>' : "";
  return `<p>${html}${caret}</p>`;
}

export default function ChatBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (isUser) {
    return (
      <div className="tp-msg-in flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-slate-100 px-4 py-2.5 text-[15px] leading-relaxed text-slate-800">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="tp-msg-in group flex gap-3.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-xs">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="chat-markdown pt-1 text-[15px] leading-relaxed text-slate-700"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content, streaming) }}
        />
        {!streaming && message.content && (
          <button
            onClick={copy}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Đã copy
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
