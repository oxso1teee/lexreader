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
  server: {
    url: "https://lexreader.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
