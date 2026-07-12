"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Upload, Loader2, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cvApi, ApiError, CvExtractResponse } from "@/lib/api";
import { FileText, CheckCircle2, AlertCircle, Sparkles, ICON } from "@/lib/icons";
import { cn } from "@/lib/utils";
import GlowCard from "@/components/brand/GlowCard";
import { Button } from "@/components/ui/button";

type CvStep = "idle" | "reading" | "analyzing" | "done" | "error";

type CvExtracted = CvExtractResponse["extracted"];

type CvDropzoneProps = {
  token: string | null;
  hasExistingCv: boolean;
  /** Fires once a parse succeeds so the parent can auto-fill PersonalInfoForm. */
  onParsed: (extracted: CvExtracted) => void;
};

/** Matches the original UX pacing: a brief "reading" beat before "analyzing" starts. */
const READ_DELAY_MS = 500;

/**
 * CvDropzone — drag/drop + click-to-browse PDF upload driving the
 * idle -> reading -> analyzing -> done -> error state machine around
 * `cvApi.upload`. Owns only the upload UI + its own step state; on a
 * successful parse it hands the extracted payload up via `onParsed` so the
 * parent can normalize + apply the fields to PersonalInfoForm.
 *
 * The parent resets this component between edit sessions by remounting it
 * with a changing `key` (see app/profile/page.tsx) rather than this
 * component exposing an imperative reset — the standard React pattern for
 * "reset state when some external condition changes".
 */
export default function CvDropzone({ token, hasExistingCv, onParsed }: CvDropzoneProps) {
  const [step, setStep] = useState<CvStep>("idle");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [summary, setSummary] = useState("");

  async function handleFile(file: File) {
    if (!token) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Chỉ hỗ trợ file PDF");
      setStep("error");
      return;
    }
    setFileName(file.name);
    setError("");
    setSummary("");
    setStep("reading");
    await new Promise((r) => setTimeout(r, READ_DELAY_MS));
    setStep("analyzing");
    try {
      const res = await cvApi.upload(token, file);
      if (res.error) {
        setError(res.error);
        setStep("error");
        return;
      }
      const d = res.extracted;
      const parts: string[] = [];
      if (d.skills?.length) parts.push(`${d.skills.length} kỹ năng`);
      if (d.desired_titles?.length) parts.push(`${d.desired_titles.length} vị trí`);
      if (d.preferred_cities?.length) parts.push(`${d.preferred_cities.length} thành phố`);
      setSummary(parts.join(", "));
      setStep("done");
      onParsed(d);
      toast.success("CV đã phân tích xong! Kiểm tra lại và nhấn Lưu.");
    } catch (err) {
      setError((err as ApiError).message || "Không thể phân tích CV");
      setStep("error");
    }
  }

  function retry() {
    setStep("idle");
    setError("");
    setFileName("");
    setSummary("");
  }

  const showChip = fileName || hasExistingCv;
  const showSuccessBadge = step === "done" || (step === "idle" && hasExistingCv && !fileName);
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      id="cv"
      className="scroll-mt-6"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <header className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-surface-2 text-text-muted">
          <FileText size={18} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-text">CV & Hồ sơ ứng tuyển</h2>
          <p className="mt-0.5 text-sm text-text-muted">Tải CV lên để AI tự động trích xuất thông tin</p>
        </div>
      </header>

      <GlowCard className="mt-4 p-6">
        {showChip && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-surface-2 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText size={16} strokeWidth={1.75} className="shrink-0 text-brand-600" />
              <span className="truncate text-sm font-medium text-text">
                {fileName || "CV đã tải lên trước đó"}
              </span>
            </div>
            {showSuccessBadge && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                <CheckCircle2 size={14} strokeWidth={2} />
                Đã tải
              </span>
            )}
          </div>
        )}

        {step === "idle" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className={cn(
              "rounded-[var(--radius-lg)] border-2 border-dashed p-10 text-center transition-all duration-200",
              dragOver
                ? "scale-[1.01] border-brand-500 bg-brand-50/60"
                : "border-border hover:border-brand-400 hover:bg-brand-50/20"
            )}
          >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-100">
              <Upload size={26} strokeWidth={1.75} className="text-brand-600" />
            </div>
            <p className="mb-1 text-sm font-medium text-text">Kéo thả file PDF vào đây</p>
            <p className="mb-4 text-xs text-text-muted">hoặc</p>
            <Button asChild>
              <label className="cursor-pointer">
                Chọn file PDF
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  aria-label="Chọn file CV định dạng PDF"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </Button>
            <p className="mt-3 text-xs text-text-muted">Hỗ trợ file PDF, tối đa 5MB</p>
          </div>
        )}

        {(step === "reading" || step === "analyzing" || step === "done") && (
          <div className="space-y-4 rounded-[var(--radius-md)] bg-surface-2 p-5">
            <ProcessStep
              icon={FileText}
              label="Đang đọc file PDF..."
              doneLabel={`Đã đọc ${fileName}`}
              active={step === "reading"}
              done={step === "analyzing" || step === "done"}
            />
            <ProcessStep
              icon={Sparkles}
              label="Đang phân tích CV bằng AI..."
              doneLabel="Phân tích CV hoàn tất"
              active={step === "analyzing"}
              done={step === "done"}
              showProgress={step === "analyzing"}
            />
            <ProcessStep
              icon={ListChecks}
              label="Đang cập nhật hồ sơ..."
              doneLabel={summary ? `Đã trích xuất: ${summary}` : "Đã cập nhật hồ sơ"}
              active={step === "done"}
              done={false}
            />
            {step === "done" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[var(--radius-md)] border border-success/30 bg-success/10 px-4 py-3 text-center text-sm text-success"
              >
                CV đã phân tích xong! Kiểm tra các trường bên dưới và nhấn <strong>Lưu</strong>.
              </motion.div>
            )}
          </div>
        )}

        {step === "error" && (
          <div className="rounded-[var(--radius-md)] border border-danger/30 bg-danger/10 p-5 text-center">
            <AlertCircle {...ICON} className="mx-auto mb-2 text-danger" />
            <p className="mb-3 text-sm text-danger">{error}</p>
            <Button type="button" onClick={retry}>
              Thử lại
            </Button>
          </div>
        )}
      </GlowCard>
    </motion.section>
  );
}

/* ── CV process step row ── */

function ProcessStep({
  icon: Icon,
  label,
  doneLabel,
  active,
  done,
  showProgress,
}: {
  icon: LucideIcon;
  label: string;
  doneLabel: string;
  active: boolean;
  done: boolean;
  showProgress?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5">
        {done ? (
          <CheckCircle2 size={20} strokeWidth={2} className="text-success" />
        ) : active ? (
          <Loader2 size={20} strokeWidth={2} className="animate-spin text-brand-600" />
        ) : (
          <Icon size={20} strokeWidth={1.75} className="text-text-muted/50" />
        )}
      </div>
      <div className="flex-1">
        <p className={cn("text-sm font-medium", done ? "text-success" : active ? "text-text" : "text-text-muted")}>
          {done ? doneLabel : label}
        </p>
        {showProgress && <AnalyzingProgressBar />}
      </div>
    </div>
  );
}

/**
 * Tokenized "analyzing" progress fill — replaces the previous inline
 * `<style>@keyframes cvProgress{...}</style>` with a plain width transition
 * driven by a mount-triggered class flip (a token-driven Tailwind
 * transition instead of a hand-written keyframe).
 */
function AnalyzingProgressBar() {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
      <div
        className={cn(
          "h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600 transition-[width] ease-linear",
          filled ? "w-[85%] duration-[45000ms]" : "w-[5%] duration-0"
        )}
      />
    </div>
  );
}
