import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import NativeBridge from "./native-bridge";
import { THEME_INIT_SCRIPT } from "./theme-init-script";
import { siteUrl } from "@/lib/site-url";
import { MomentProvider } from "@/components/product/moments/moment-provider";

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
        <NativeBridge />
        {/* docs/moments/ROADMAP.md, этап 1 — /read и /watch живут вне
            (app)/layout.tsx (не в той же route group), но finishReading()
            тоже возвращает moments[] (сессия чтения) — провайдер поднят на
            уровень выше (app)/layout.tsx раньше его держал, чтобы оба дерева
            маршрутов делили одну очередь, а не плодили вторую копию. */}
        <MomentProvider>{children}</MomentProvider>
      </body>
    </html>
  );
}
