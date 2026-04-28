"use client";

import { InputHTMLAttributes, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  label: string;
  error?: string;
  password?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

export default function AuthInput({ label, error, password, type, ...rest }: Props) {
  const [show, setShow] = useState(false);
  const inputType = password ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          className={`w-full rounded-lg border px-4 py-2.5 text-sm outline-none transition-all duration-200 ${
            error
              ? "border-red-400 focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
              : "border-slate-200 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          }`}
          {...rest}
        />
        {password && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs select-none"
          >
            {show ? "Ẩn" : "Hiện"}
          </button>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="text-red-500 text-xs"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
