"use client";

import AdminProtectedRoute from "@/components/auth/AdminProtectedRoute";
import AdminSidebar from "./AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProtectedRoute>
      <div className="flex min-h-screen bg-slate-50">
        <AdminSidebar />
        <main className="flex-1 min-w-0 p-8 overflow-auto">{children}</main>
      </div>
    </AdminProtectedRoute>
  );
}
