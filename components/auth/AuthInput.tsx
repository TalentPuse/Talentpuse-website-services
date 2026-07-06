"use client";

import { InputHTMLAttributes, useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  error?: string;
  password?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

/**
 * AuthInput — shadcn Input + Label wrapper shared by /signin and /signup.
 * Adds a password show/hide toggle and an inline, animated error message.
 * Styled for the dark-glass auth surface but relies entirely on semantic
 * tokens, so it stays correct if the page is ever rendered light.
 */
export default function AuthInput({
  label,
  error,
  password,
  type,
  id,
  ...rest
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [show, setShow] = useState(false);
  const inputType = password ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-text-muted">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={inputId}
          type={inputType}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-11 border-white/15 bg-white/[0.04] text-text placeholder:text-text-muted/50",
            "focus-visible:border-brand-400 focus-visible:ring-brand-500/40",
            password && "pr-11",
            error && "border-danger/60 focus-visible:border-danger focus-visible:ring-danger/30"
          )}
          {...rest}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-text-muted transition-colors hover:text-text"
          >
            {show ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={errorId}
            role="alert"
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1 text-xs text-danger"
          >
            <AlertCircle size={13} strokeWidth={1.75} className="shrink-0" />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
