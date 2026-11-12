import type { Metadata, Viewport } from "next";
import { Geist_Mono, Unbounded, Onest } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import NativeBridge from "./native-bridge";
import { THEME_INIT_SCRIPT } from "./theme-init-script";
import { siteUrl } from "@/lib/site-url";
import { Toaster } from "@/components/ui/toast";
import { MomentProvider } from "@/components/product/moments/moment-provider";
import WeeklyRankGate from "@/components/product/moments/weekly-rank-gate";
import WelcomeBackGate from "@/components/product/moments/welcome-back-gate";
import WeekRecapGate from "@/components/product/moments/week-recap-gate";
import ReviewDueGate from "@/components/product/moments/review-due-gate";
import TwinInsightGate from "@/components/product/moments/twin-insight-gate";

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
  // Без metadataBase Next.js резолвит og:image/twitter:image относительно
  // http://localhost:3000 в прод-сборке (warning при build) — расшаренная
  // ссылка показывает битое превью. siteUrl() — тот же источник домена, что
  // и письма сброса пароля / Stripe-редиректы (src/lib/site-url.ts).
  metadataBase: new URL(siteUrl()),
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
  // Красит мобильный браузер/PWA-хром (статус-бар). Metadata — обычный JS
  // объект и не может ссылаться на CSS-переменные, поэтому значения —
  // raw hex фона приложения (--background) для каждой схемы; держать в
  // синхроне с src/app/globals.css при смене поверхностей. Раньше здесь
  // был акцентный #4fce23 (устаревший --leaf), из-за чего в тёмной теме
  // статус-бар светился зелёным поверх тёмного приложения.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
  ],
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
        <NativeBridge />
        {/* docs/moments/ROADMAP.md, этап 1 — /read и /watch живут вне
            (app)/layout.tsx (не в той же route group), но finishReading()
            тоже возвращает moments[] (сессия чтения) — провайдер поднят на
            уровень выше (app)/layout.tsx раньше его держал, чтобы оба дерева
            маршрутов делили одну очередь, а не плодили вторую копию. */}
        <MomentProvider>
          <WeeklyRankGate />
          <WelcomeBackGate />
          <WeekRecapGate />
          <ReviewDueGate />
          <TwinInsightGate />
          {children}
        </MomentProvider>
        {/* Единая система уведомлений: toast.* из "@/lib/ui/toast" + статус
            сети. Вне MomentProvider — не зависит от очереди «моментов». */}
        <Toaster />
      </body>
    </html>
  );
}
