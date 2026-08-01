import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV !== "production";

// posthog-js вычисляет CDN-хост для своего скрипта из api_host по региону
// (см. node_modules/posthog-js/dist/module.full.js, endpointFor("assets")):
// us(.i)?.posthog.com -> us-assets.i.posthog.com, eu(.i)?.posthog.com ->
// eu-assets.i.posthog.com. Для self-hosted/кастомного хоста отдельного
// assets-CDN нет — скрипт грузится с того же хоста, что и api_host.
// Копируем эту же логику здесь, а не хардкодим регион, чтобы CSP не
// рассинхронизировалась с NEXT_PUBLIC_POSTHOG_HOST при смене региона.
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const posthogRegion = /^https:\/\/(app|us|us-assets)(\.i)?\.posthog\.com/i.test(posthogHost)
  ? "us"
  : /^https:\/\/(eu|eu-assets)(\.i)?\.posthog\.com/i.test(posthogHost)
    ? "eu"
    : null;
const posthogAssetsHost = posthogRegion ? `https://${posthogRegion}-assets.i.posthog.com` : posthogHost;

// P0-SEC-06 release-readiness промта: базовый набор security-заголовков.
// P0-АУДИТ 2.3/2.4: cdn.jsdelivr.net нужен tesseract.js (воркер/wasm-ядро/
// файлы языка распознавания — грузятся оттуда по умолчанию, см.
// node_modules/tesseract.js/src/worker/browser/defaultOptions.js), иначе
// фото-OCR-импорт молча ломается по CSP. www.youtube.com в script-src
// нужен для бутстрапа YouTube IFrame Player API (watch-player.tsx) — без
// него Watch Mode не грузит видео вообще (frame-src тут не помогает,
// блокируется ещё до создания iframe).
// ws:/wss: нужны только Turbopack HMR в dev — в проде их разрешать незачем
// (иначе XSS-пейлоад мог бы открыть WebSocket на любой хост).
// posthog-js грузит свой скрипт с posthogAssetsHost (script-src) и шлёт
// события/decide-запросы на posthogHost (connect-src) — оба выведены выше
// из NEXT_PUBLIC_POSTHOG_HOST, без этого posthog.init() молча ловит CSP
// violation и ни один ивент не долетает до PostHog. posthogAssetsHost нужен
// ещё и в connect-src: помимо <script src>, RemoteConfig-загрузчик делает
// отдельный fetch() на тот же assets-хост за конфигом (.../array/<key>/config,
// без .js) — это уже не script-src, а именно connect-src.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.youtube.com ${posthogAssetsHost}`,
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""} ${supabaseUrl} https://api.mymemory.translated.net https://cdn.jsdelivr.net ${posthogHost} ${posthogAssetsHost}`,
  "frame-src https://www.youtube.com",
  "frame-ancestors 'none'",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  // Next.js 16: dev-ресурсы (HMR websocket, бутстрап гидратации) по
  // умолчанию блокируются для кросс-origin запросов — "localhost" и
  // "127.0.0.1" браузер считает РАЗНЫМИ origin, хотя это один и тот же
  // компьютер. Без этого приложение при открытии через 127.0.0.1
  // молча не гидрируется (HMR-сокет получает отказ, React не крепится).
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
