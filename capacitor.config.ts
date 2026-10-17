import type { CapacitorConfig } from "@capacitor/cli";

// docs/release-2026-08-22/04_MOBILNAYA_STRATEGIYA_APP_STORE_GOOGLE_PLAY.md —
// remote-URL режим, НЕ static export. LexReader целиком построен на Server
// Actions + cookie-based Supabase SSR-сессиях (десятки "use server" файлов,
// middleware/proxy.ts) — `next export`/static output не умеет ни то, ни
// другое вообще. Вместо бандла статических файлов WebView грузит уже
// задеплоенный прод-сайт напрямую — ровно то же самое, что открыть его в
// мобильном Safari/Chrome: каждый Server Action/API route/поток
// авторизации продолжает работать без единой правки в самом Next.js-коде,
// существующий Vercel-деплой веб-версии не тронут вообще.
//
// url ниже — lexreader.vercel.app (реальный, живой Vercel-домен,
// подтверждено `vercel project inspect` — под этим проектом НЕ подключено
// ни одного кастомного домена, `vercel domains ls` вернул 0). Домен
// lexreader.app, который уже встречается как aspirational-запись в
// browser-extension/manifest.json ALLOWED_APP_ORIGINS, пока не подключён к
// Vercel — обновить эту строку на него, как только (и если) он реально
// заработает, см. финальный чек-лист.
const config: CapacitorConfig = {
  appId: "com.lexreader.app",
  appName: "LexReader",
  webDir: "www",
  // Цвет фона окна WebView до загрузки сайта — без него на старте мелькает
  // белый экран (совпадает с --background светлой темы).
  backgroundColor: "#f5f1ea",
  server: {
    url: "https://lexreader.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    // Долгий тап по ссылке в WebView не должен открывать превью-попап Safari.
    allowsLinkPreview: false,
  },
  plugins: {
    // Сплэш закрывает src/app/native-bridge.tsx сразу после гидрации; таймер —
    // страховка, если сайт не загрузился (нет сети) и JS не отработал.
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      backgroundColor: "#f5f1ea",
      showSpinner: false,
    },
    Keyboard: {
      // Страница сжимается под клавиатуру, а не уезжает вверх целиком.
      resize: "body",
    },
  },
};

export default config;
