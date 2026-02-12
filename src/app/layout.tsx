import "./globals.css";
import type { Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import LayoutClient from "./components/LayoutClient"; // ใช้ client wrapper

const notoThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  display: "swap",
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="h-full" suppressHydrationWarning>
      <body className={`${notoThai.variable} h-full min-h-[100dvh] antialiased`} suppressHydrationWarning>
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
