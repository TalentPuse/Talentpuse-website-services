"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cvDocumentApi } from "@/lib/api";

type State = "loading" | "ready" | "empty" | "error";

export default function CvPreview() {
  const { token } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let off = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        // 1) Ensure the document exists (builds from cv_text on first call).
        const doc = await cvDocumentApi.get(token);
        if (!doc.pdf_url) {
          if (!off) setState("empty");
          return;
        }
        // 2) Fetch the rendered PDF same-origin (authed) → blob URL for the iframe.
        const blob = await cvDocumentApi.getPdfBlob(token);
        if (off) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setState("ready");
      } catch (e: unknown) {
        if (off) return;
        const status = (e as { status?: number })?.status;
        setState(status === 409 ? "empty" : "error");
      }
    })();

    return () => {
      off = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token]);

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2.5">
        <span className="text-sm font-medium text-slate-500">CV của bạn</span>
        {pdfUrl && (
          <a
            href={pdfUrl}
            download="cv.pdf"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            ⭳ Tải PDF
          </a>
        )}
      </div>
      <div className="flex-1 overflow-hidden p-3">
        {state === "loading" && (
          <div className="relative h-full w-full">
            <div className="h-full w-full animate-pulse rounded-xl bg-slate-200" />
            <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">
              Đang render CV…
            </span>
          </div>
        )}
        {state === "empty" && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-slate-500">
            Chưa có CV. Upload CV ở trang{" "}
            <a href="/profile" className="text-brand-600 underline">
              Hồ sơ
            </a>{" "}
            để mình render ra đây.
          </div>
        )}
        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-red-600">
            Không tải được CV. Thử lại sau nhé.
          </div>
        )}
        {state === "ready" && pdfUrl && (
          <iframe
            title="CV"
            src={pdfUrl}
            className="h-full w-full rounded-xl border border-slate-200 bg-white"
          />
        )}
      </div>
    </div>
  );
}
