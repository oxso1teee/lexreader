import type { Metadata, Viewport } from "next";
import { Geist_Mono, Unbounded, Onest } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import { THEME_INIT_SCRIPT } from "./theme-init-script";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// redesign/duolingo-flat: display/heading font (Unbounded, bold/geometric)
// + body font (Onest) — replaces Geist Sans (removed: grepped for
// --font-geist-sans/font-sans usage outside globals.css's own token
// mapping, found none). cyrillic subset required — app UI is Russian-first.
const unbounded = Unbounded({
  variable: "--font-unbounded",
  weight: ["700", "900"],
  subsets: ["latin", "cyrillic"],
});

const onest = Onest({
  variable: "--font-onest",
  weight: ["400", "600", "700"],
  subsets: ["latin", "cyrillic"],
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
  // Красит мобильный браузер/PWA-хром (статус-бар) — видно почти на каждом
  // экране на телефоне. Не CSS custom property (metadata — обычный JS
  // объект, не может ссылаться на var(--leaf)) — raw hex, держать в
  // синхроне с --leaf из src/styles/tokens.css вручную при следующей
  // смене акцента (redesign/duolingo-flat: старый forest #1f4d3b → leaf
  // #4fce23).
  themeColor: "#4fce23",
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
      // Атрибут выставляется ниже скриптом ещё до гидрации — без этого
      // React ругался бы на расхождение серверного/клиентского HTML на
      // каждой загрузке (сервер не знает выбор темы устройства).
      suppressHydrationWarning
      className={`${unbounded.variable} ${onest.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
