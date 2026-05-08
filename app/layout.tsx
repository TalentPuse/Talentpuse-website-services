import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: "TalentPuse",
  description:
    "Thu thập và phân tích dữ liệu tuyển dụng IT/AI từ 10+ nguồn tại Việt Nam. Dashboard trực quan, AI job alert qua Telegram/Zalo/Discord.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
