"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = user?.full_name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            TalentPulse
          </span>
        </a>

        <div className="hidden md:flex items-center gap-1 text-sm text-slate-500">
          <a href="/dashboard" className="hover:text-brand-600 transition px-3 py-1.5 rounded-md hover:bg-brand-50">
            Dashboard
          </a>
          <a href="/jobs" className="hover:text-brand-600 transition px-3 py-1.5 rounded-md hover:bg-brand-50">
            Tìm việc
          </a>
          <a href="/profile" className="hover:text-brand-600 transition px-3 py-1.5 rounded-md hover:bg-brand-50">
            Hồ sơ
          </a>
          {user?.is_admin && (
            <a href="/admin" className="hover:text-brand-600 transition px-3 py-1.5 rounded-md hover:bg-brand-50">
              Admin
            </a>
          )}
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-slate-100 transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {initials}
            </div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block max-w-[140px] truncate">
              {user?.full_name}
            </span>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg shadow-black/8 border border-slate-200/80 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <a
                    href="/profile"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition"
                  >
                    Hồ sơ của tôi
                  </a>
                  <a
                    href="/dashboard"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition md:hidden"
                  >
                    Dashboard
                  </a>
                  <a
                    href="/jobs/alerts"
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition"
                  >
                    Lịch sử Alert
                  </a>
                  {user?.is_admin && (
                    <a
                      href="/admin"
                      className="block px-4 py-2 text-sm text-slate-700 hover:bg-brand-50 hover:text-brand-700 transition"
                    >
                      Admin
                    </a>
                  )}
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    Đăng xuất
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
