import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME || "AIX Knowledge Slides",
    template: `%s | AIX Slides`,
  },
  description: "영상 지식을 슬라이드로 빠르게 소비하는 개인 지식 자산 플랫폼",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
