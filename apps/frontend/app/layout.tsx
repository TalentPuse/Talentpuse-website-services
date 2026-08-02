import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { Agentation } from "agentation";
import { Providers } from "./providers";

const display = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  variable: "--font-display",
  display: "swap",
});
const sans = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TalentPuse",
  description:
    "Thu thập và phân tích dữ liệu tuyển dụng IT/AI từ 10+ nguồn tại Việt Nam. Dashboard trực quan, AI job alert qua Telegram/Zalo/Discord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body className="font-sans bg-bg text-text antialiased">
        {/*
          Tracker Umami, phuc vu FIRST-PARTY qua /s/* (xem deploy/nginx/nginx.conf).

          data-host-url="/s" la BAT BUOC: thieu no thi script gui su kien ve
          `/api/send`, ma nginx dinh tuyen `/api/` sang FastAPI — backend tra
          404 va TOAN BO su kien bi mat, im lang, khong bao loi o dau ca.

          Duong dan `/s/` (khong phai `/umami/` hay `/analytics/`) la de tranh
          luat mac dinh cua trinh chan quang cao von khop theo chuoi con.

          `defer` de script khong chan render; do luu luong khong bao gio duoc
          phep lam cham trang.
        */}
        <script
          defer
          src="/s/script.js"
          data-website-id={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
          data-host-url="/s"
        />
        <Providers>{children}</Providers>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
