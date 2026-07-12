"use client";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Download, FileText, AlertCircle } from "@/lib/icons";
import { useAuth } from "@/context/AuthContext";
import { cvDocumentApi } from "@/lib/api";
import AIBadge from "@/components/brand/AIBadge";
import { Skeleton } from "@/components/ui/skeleton";

type State = "loading" | "ready" | "empty" | "error";

export default function CvPreview({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const { token } = useAuth();
  const [state, setState] = useState<State>("loading");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  // Bumped by the toolbar's refresh button to re-run the fetch effect below
  // without touching its fetch/AbortController/blob-URL logic.
  const [manualRefresh, setManualRefresh] = useState(0);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;

    (async () => {
      try {
        // 1) Ensure the document exists (builds from cv_text on first call).
        const doc = await cvDocumentApi.get(token, controller.signal);
        if (!doc.pdf_url) {
          setState("empty");
          return;
        }
        // 2) Fetch the rendered PDF same-origin (authed) → blob URL for the iframe.
        const blob = await cvDocumentApi.getPdfBlob(token, controller.signal);
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
        setPageCount(doc.page_count);
        setState("ready");
      } catch (e: unknown) {
        if (controller.signal.aborted) return; // unmounted / re-run — ignore
        const status = (e as { status?: number })?.status;
        setState(status === 409 ? "empty" : "error");
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, refreshSignal, manualRefresh]);

  function handleManualRefresh() {
    setState("loading");
    setManualRefresh((n) => n + 1);
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-bg">
      {/* Artifact-panel toolbar */}
      <div className="flex h-[57px] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text">CV của bạn</span>
          <AIBadge label="AI" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {pageCount != null && (
            <span className="mr-1 hidden text-xs text-text-muted sm:inline">
              {pageCount} trang
            </span>
          )}
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={state === "loading"}
            aria-label="Làm mới CV"
            title="Làm mới"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-2 hover:text-text disabled:opacity-40"
          >
            <RefreshCw className={state === "loading" ? "h-4 w-4 animate-spin" : "h-4 w-4"} strokeWidth={1.9} />
          </button>
          {pdfUrl && (
            <a
              href={pdfUrl}
              download="cv.pdf"
              aria-label="Tải PDF"
              title="Tải PDF"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-2 hover:text-brand-600 dark:hover:text-brand-400"
            >
              <Download className="h-4 w-4" strokeWidth={1.9} />
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-3">
        {state === "loading" && (
          <div className="relative h-full w-full">
            <Skeleton className="h-full w-full rounded-xl" />
            <span className="absolute inset-0 flex items-center justify-center text-xs text-text-muted">
              Đang render CV…
            </span>
          </div>
        )}
        {state === "empty" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-text-muted">
            <FileText className="h-8 w-8 text-text-muted/60" strokeWidth={1.5} />
            <p>
              Chưa có CV. Upload CV ở trang{" "}
              <a href="/profile" className="text-brand-400 underline hover:text-brand-300">
                Hồ sơ
              </a>{" "}
              để mình render ra đây.
            </p>
          </div>
        )}
        {state === "error" && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-danger">
            <AlertCircle className="h-8 w-8" strokeWidth={1.5} />
            Không tải được CV. Thử lại sau nhé.
          </div>
        )}
        {state === "ready" && pdfUrl && (
          <iframe
            title="CV"
            src={pdfUrl}
            className="h-full w-full rounded-xl border border-border bg-surface"
          />
        )}
      </div>
    </div>
  );
}
