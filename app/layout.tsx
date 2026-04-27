import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TalentPulse — DE/AI Job Market VN",
  description:
    "Dashboard cho job seekers Data Engineer / AI tại Vietnam. Skills hot, salary range, top companies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
