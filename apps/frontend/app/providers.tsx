"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";

export function Providers({ children }: { children: React.ReactNode }) {
  // forcedTheme: điểm chốt DUY NHẤT của theme. ForceTheme cũ gọi setTheme()
  // nên next-themes đã GHI "dark" vào localStorage của mọi user từng ghé
  // /signin, /signup hay /interview — chỉ xoá các chỗ ép dark là chưa đủ,
  // họ vẫn thấy web tối. forcedTheme đè lên cả giá trị đã lưu.
  // Bỏ đúng một dòng này là bật lại được dark mode.
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light" disableTransitionOnChange>
      <AuthProvider>
        {children}
        <Toaster position="top-right" richColors closeButton toastOptions={{ className: "font-sans" }} />
      </AuthProvider>
    </ThemeProvider>
  );
}
