"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Bot } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/chat-types";

/** Lightweight markdown → HTML for assistant messages */
function renderMarkdown(md: string, streaming?: boolean): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="bg-surface-2 border border-border text-text rounded-xl p-3.5 my-3 overflow-x-auto text-[13px] leading-relaxed"><code>${code.trim()}</code></pre>`,
  );
  html = html.replace(/`([^`]+)`/g, '<code class="bg-surface-2 text-brand-600 dark:text-brand-400 px-1.5 py-0.5 rounded-sm text-[13px]">$1</code>');

  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/g,
    (_m, headerRow: string, _sep: string, bodyRows: string) => {
      const parseCells = (row: string) => row.split("|").filter((c) => c.trim()).map((c) => c.trim());
      const headers = parseCells(headerRow);
      const rows = bodyRows.trim().split("\n").filter((r) => r.includes("|")).map(parseCells);
      return (
        `<div class="my-3 overflow-x-auto rounded-xl border border-border"><table class="w-full text-[13px] border-collapse"><thead><tr>` +
        headers.map((h) => `<th class="border-b border-border px-3 py-2 bg-surface-2 text-left font-semibold text-text">${h}</th>`).join("") +
        `</tr></thead><tbody>` +
        rows.map((cells) => `<tr>${cells.map((c) => `<td class="border-b border-border px-3 py-2 text-text-muted">${c}</td>`).join("")}</tr>`).join("") +
        `</tbody></table></div>`
      );
    },
  );

  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-[15px] font-semibold text-text mt-4 mb-1.5">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-text mt-4 mb-1.5">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-text mt-5 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-text mt-5 mb-2">$1</h1>');
  html = html.replace(/^---+$/gm, '<hr class="my-4 border-border" />');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-text">$1</strong>');
  html = html.replace(/^\s*[-*] (.+)$/gm, '<li class="ml-1">$1</li>');
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-2 space-y-1 list-disc pl-5 marker:text-text-muted">$1</ul>');
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
        <div className="max-w-[80%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed text-text">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="tp-msg-in group flex gap-3.5">
      <div
        className={cn(
          "ai-gradient mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-xs",
          streaming && "ai-glow",
        )}
      >
        <Bot className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="chat-markdown pt-1 text-[15px] leading-relaxed text-text/90"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content, streaming) }}
        />
        {!streaming && message.content && (
          <button
            onClick={copy}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-text-muted opacity-0 transition hover:bg-surface-2 hover:text-text group-hover:opacity-100"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.2} />
                Đã copy
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                Copy
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
