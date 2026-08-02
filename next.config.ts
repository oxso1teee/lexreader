import type { NextConfig } from "next";
import { getPostHogCspHosts } from "./src/lib/posthog-csp.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV !== "production";
const { apiHost: posthogApiHost, assetsHost: posthogAssetsHost } = getPostHogCspHosts(
  process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

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
// PostHog CSP hotfix (2026-08-02, см. docs/analytics/posthog-csp-fix.md):
// posthog-js грузит array.js/config.js со отдельного "-assets"-поддомена
// (script-src) и шлёт capture/decide-запросы на основной host (connect-src)
// — без обоих production полностью не получал ни одного события с момента
// подключения PostHog. Хосты выводятся из NEXT_PUBLIC_POSTHOG_HOST той же
// логикой, что использует сам SDK (src/lib/posthog-csp.ts), а не
// захардкожены — тот же fallback-host, что в posthog-client.ts/
// posthog-server.ts, и тот же self-hosted-режим (assets с того же домена).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://www.youtube.com ${posthogAssetsHost}`,
  "worker-src 'self' blob: https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""} ${supabaseUrl} https://api.mymemory.translated.net https://cdn.jsdelivr.net ${posthogApiHost}`,
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
