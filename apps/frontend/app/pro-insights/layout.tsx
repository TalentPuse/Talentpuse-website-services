"use client";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
export default function ProLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.subscription_tier !== "pro" && !user.is_admin)
    return (
      <DashboardLayout>
        <div className="p-8">
          <h1>Pro Insights — Dành cho tài khoản Pro</h1>
          <a href="/pricing">Nâng cấp</a>
        </div>
      </DashboardLayout>
    );
  return (
    <DashboardLayout>
      <ProtectedRoute>{children}</ProtectedRoute>
    </DashboardLayout>
  );
}
