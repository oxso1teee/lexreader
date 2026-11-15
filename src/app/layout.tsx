import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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

// Шрифты self-host (next/font/local), а не next/font/google: Google Fonts API
// периодически отвечает URL-ами вида fonts.gstatic.com/l/font?kit=…&skey=…
// (без расширения), на которых `next build` падает и в Turbopack, и в webpack
// — случайные красные сборки в CI/Vercel. Происхождение файлов, лицензии OFL
// и пересборка — в src/app/fonts/README.md. Объявленные веса, CSS-переменные
// и fallback-метрики те же, что были у next/font/google.
const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
});

// redesign/duolingo-flat: display/heading font (Unbounded, bold/geometric)
// + body font (Onest) — replaces Geist Sans (removed: grepped for
// --font-geist-sans/font-sans usage outside globals.css's own token
// mapping, found none). Cyrillic coverage required — app UI is Russian-first.
// Каждый вес — отдельный @font-face на один и тот же variable-файл, как раньше
// у next/font/google (там тоже по @font-face на вес).
const unbounded = localFont({
  src: [
    { path: "./fonts/Unbounded-Variable.woff2", weight: "700", style: "normal" },
    { path: "./fonts/Unbounded-Variable.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-unbounded",
  display: "swap",
});

const onest = localFont({
  src: [
    { path: "./fonts/Onest-Variable.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Onest-Variable.woff2", weight: "600", style: "normal" },
    { path: "./fonts/Onest-Variable.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-onest",
  display: "swap",
});

// Шрифт чтения (Source Serif 4, подмножество «Reading Serif 4» — см. src/app/fonts/README.md) —
// глобально: макеты v7 используют его не только в читалке, но и в занятии,
// карточках слов, моментах (docs/moments).
const readingSerif = localFont({
  src: "./fonts/ReadingSerif4-Variable.woff2",
  weight: "200 900",
  variable: "--font-reading",
  display: "swap",
  adjustFontFallback: "Times New Roman",
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
      className={`${unbounded.variable} ${onest.variable} ${readingSerif.variable} ${geistMono.variable} h-full antialiased`}
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
