import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TalentPulse — IT/AI Job Market Vietnam",
  description:
    "Thu thập và phân tích dữ liệu tuyển dụng IT/AI từ 10+ nguồn tại Việt Nam. Dashboard trực quan, AI job alert qua Telegram/Zalo/Discord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
