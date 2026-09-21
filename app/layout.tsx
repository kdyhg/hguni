import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/optical-glass.css";

export const metadata: Metadata = {
  title: "유니쿨 아침선도",
  description: "학생회 아침 선도활동 기록 도구",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#e8eee5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
