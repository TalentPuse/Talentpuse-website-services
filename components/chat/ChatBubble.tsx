"use client";

import type { ChatMessage } from "@/lib/chat-types";

function formatTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;

  return date.toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Lightweight markdown → HTML for bot messages */
function renderMarkdown(md: string): string {
  let html = md
    // Escape HTML first (but preserve what we generate)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) =>
    `<pre class="bg-slate-800 text-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>${code.trim()}</code></pre>`
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-brand-700 px-1.5 py-0.5 rounded text-xs">$1</code>');

  // Tables
  html = html.replace(
    /(?:^|\n)(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/g,
    (_m, headerRow: string, _sep: string, bodyRows: string) => {
      const parseCells = (row: string) =>
        row
          .split("|")
          .filter((c) => c.trim())
          .map((c) => c.trim());
      const headers = parseCells(headerRow);
      const rows = bodyRows
        .trim()
        .split("\n")
        .filter((r) => r.includes("|"))
        .map(parseCells);
      return (
        `<table class="w-full text-xs my-2 border-collapse"><thead><tr>` +
        headers.map((h) => `<th class="border border-slate-200 px-2 py-1 bg-slate-50 text-left font-semibold">${h}</th>`).join("") +
        `</tr></thead><tbody>` +
        rows
          .map(
            (cells) =>
              `<tr>${cells.map((c) => `<td class="border border-slate-200 px-2 py-1">${c}</td>`).join("")}</tr>`,
          )
          .join("") +
        `</tbody></table>`
      );
    },
  );

  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4 class="text-sm font-semibold text-slate-800 mt-3 mb-1">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-slate-900 mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-slate-900 mt-4 mb-2">$1</h1>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="my-3 border-slate-200" />');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');

  // Unordered lists (handle indented items)
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-700">$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>');

  // Paragraphs: double newlines
  html = html.replace(/\n{2,}/g, "</p><p class='my-2'>");

  // Single newlines → <br> (but not inside pre/code/table)
  html = html.replace(/\n/g, "<br />");

  return html;
}

export default function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%]">
          <div className="bg-brand-600 text-white px-4 py-3 rounded-2xl rounded-br-md shadow-sm">
            <p className="text-sm">{message.content}</p>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right">
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </div>

      <div className="max-w-[85%] min-w-0">
        <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
          <div
            className="text-sm text-slate-700 chat-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        </div>
        <p className="text-[10px] text-slate-400 mt-1 ml-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
