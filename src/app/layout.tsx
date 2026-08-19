import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LexReader",
  description: "Учи язык через чтение реальных текстов",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  // Раздел 5 промта 2026-07-30 (полировка): раньше ссылка при шаринге
  // показывала стандартную заглушку Next.js — превью теперь генерируется
  // файлом opengraph-image.tsx (Next.js подставляет og:image сам).
  openGraph: {
    title: "LexReader",
    description: "Учи язык через чтение реальных текстов",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LexReader",
    description: "Учи язык через чтение реальных текстов",
  },
};

export const viewport: Viewport = {
  // Gamified redesign: dark navy is now the default appearance (was
  // caramel #a67c52) -- see src/app/globals.css / src/styles/tokens.css.
  themeColor: "#0a1120",
  // M3 Slice 1: без viewportFit "cover" env(safe-area-inset-*) в
  // MobileBottomNav не активен на iOS (docs/ui/current-ui-audit.md §5).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The inline THEME_INIT_SCRIPT below stamps data-theme on this real
      // DOM element (synchronously, before hydration) so there's no flash
      // of the wrong theme -- React's virtual tree never renders that
      // attribute itself, so without this it always reports a hydration
      // mismatch on first load. This is the standard, documented pattern
      // for exactly this dark-mode anti-flash technique.
      suppressHydrationWarning
    >
      <head>
        {/* Gamified redesign: stamps data-theme from localStorage before
            first paint so an explicit light-theme choice never flashes
            dark first. See src/lib/theme.ts (source of truth for this
            script's logic -- keep the two in sync by hand). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
