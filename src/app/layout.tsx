import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Source_Serif_4, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import RegisterServiceWorker from "./register-service-worker";
import { THEME_INIT_SCRIPT } from "./theme-init-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Промпт 1 (реальный serif для текста чтения) — --font-serif в
// tokens.css уже существовал, но был запитан от --font-playfair, которая
// подключена только внутри landing-page.tsx (next/font/google, scoped) —
// вне этого дерева переменная не в области видимости, и font-serif на
// /read/[textId] проваливался на Georgia/serif-фолбэк, никогда не
// показывая реальный веб-шрифт. Отдельный токен --font-reader-serif,
// подключённый здесь в корневом layout.tsx (в области видимости везде),
// специально для тела читаемого текста — не трогает --font-serif
// (заголовки лендинга, вне этой задачи).
const sourceSerif = Source_Serif_4({
  variable: "--font-reader-serif",
  subsets: ["latin", "cyrillic"],
});

// Промпт 2 (serif-заголовок Библиотеки + инфраструктура для остальных
// экранов) — перенесено сюда из landing-page.tsx (было scoped там же,
// вне области видимости на всех остальных страницах). §1.2 брендбука
// разрешает serif не только на лендинге, но и на заголовках уровня
// hero/H1 нескольких реальных экранов — раз он понадобится больше чем в
// одном месте, шрифт грузится один раз в корневом layout.tsx, как и
// --font-reader-serif выше. Имя переменной то же самое (--font-playfair)
// — --font-serif в tokens.css уже резолвится через var(--font-playfair),
// Georgia, serif и заработает без правки токена.
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
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
  // docs/release-2026-08-26/12_VIZUALNAYA_IDENTICHNOST_RESHENIE_2026-08-26.md
  // — единственный акцент. Красит мобильный браузер/PWA-хром (статус-бар) —
  // видно почти на каждом экране на телефоне, старый caramel пережил
  // миграцию #49 (та искала Tailwind-классы, не raw hex в объекте
  // метаданных). --color-forest из tokens.css.
  themeColor: "#1f4d3b",
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
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} ${playfairDisplay.variable} h-full antialiased`}
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
