"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cvDocumentApi, type CvDocument } from "@/lib/api";

export default function CvPreview() {
  const { token } = useAuth();
  const [doc, setDoc] = useState<CvDocument | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  useEffect(() => {
    if (!token) return;
    let off = false;
    cvDocumentApi
      .get(token)
      .then((d) => {
        if (!off) {
          setDoc(d);
          setState(d.pdf_url ? "ready" : "empty");
        }
      })
      .catch((e) => {
        if (!off) setState(e?.status === 409 ? "empty" : "error");
      });
    return () => {
      off = true;
    };
  }, [token]);

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2.5">
        <span className="text-sm font-medium text-slate-500">CV của bạn</span>
        {doc?.pdf_url && (
          <a
            href={doc.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            ⭳ Tải PDF
          </a>
        )}
      </div>
      <div className="flex-1 overflow-hidden p-3">
        {state === "loading" && (
          <div className="h-full w-full animate-pulse rounded-xl bg-slate-200" />
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
          <div className="p-4 text-sm text-red-600">Không tải được CV.</div>
        )}
        {state === "ready" && doc?.pdf_url && (
          <iframe
            title="CV"
            src={doc.pdf_url}
            className="h-full w-full rounded-xl border border-slate-200 bg-white"
          />
        )}
      </div>
    </div>
  );
}
