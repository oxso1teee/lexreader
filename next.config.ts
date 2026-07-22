import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// P0-SEC-06 release-readiness промта: базовый набор security-заголовков.
// ws:/wss: в connect-src нужны Turbopack HMR в dev-режиме — в проде это не
// используется, но next.config.ts общий для обоих режимов.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ws: wss: ${supabaseUrl} https://api.mymemory.translated.net`,
  "frame-src https://www.youtube.com",
  "frame-ancestors 'none'",
].join("; ");

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
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
