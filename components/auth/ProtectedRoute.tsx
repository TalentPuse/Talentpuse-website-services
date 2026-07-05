"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/signin?redirect=" + encodeURIComponent(window.location.pathname));
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-brand-50/30">
        <div className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60" />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-xl skeleton" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="h-96 rounded-xl skeleton" />
            <div className="h-96 rounded-xl skeleton" />
          </div>
          <div className="h-96 rounded-xl skeleton" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
