"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import UmamiIdentify from "@/components/analytics/UmamiIdentify";

/**
 * Cau noi giua AuthContext va Umami.
 *
 * Phai la mot component RIENG nam BEN TRONG <AuthProvider>: useAuth() nem loi
 * neu goi ngoai provider, nen khong the goi thang trong <Providers>.
 *
 * Chi lay `user.id`. `UserResponse` con co email va full_name ngay canh do —
 * tuyet doi khong truyen ca object sang ben thu ba.
 */
function AnalyticsIdentity() {
  const { user } = useAuth();
  return <UmamiIdentify userId={user?.id ?? null} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  // forcedTheme: điểm chốt DUY NHẤT của theme. ForceTheme cũ gọi setTheme()
  // nên next-themes đã GHI "dark" vào localStorage của mọi user từng ghé
  // /signin, /signup hay /interview — chỉ xoá các chỗ ép dark là chưa đủ,
  // họ vẫn thấy web tối. forcedTheme đè lên cả giá trị đã lưu.
  // Bỏ đúng một dòng này là bật lại được dark mode.
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light" disableTransitionOnChange>
      <AuthProvider>
        <AnalyticsIdentity />
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
