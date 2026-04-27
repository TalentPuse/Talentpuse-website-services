import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TalentPulse — IT/AI Job Market Vietnam",
  description:
    "Thu thap va phan tich du lieu tuyen dung IT/AI tu 10+ nguon tai Viet Nam. Dashboard truc quan, AI job alert qua Telegram/Zalo/Discord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
