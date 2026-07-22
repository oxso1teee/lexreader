"use client";

import { useEffect } from "react";

// PWA-манифест + offline app-shell (P0-MOB-01..03) работают независимо от
// push-уведомлений — регистрируем service worker сразу, а не только при
// включении пушей (см. settings-client.tsx, который переиспользует эту же
// регистрацию через navigator.serviceWorker.ready).
export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Офлайн-кеш — необязательное улучшение, не критично для работы приложения.
      });
    }
  }, []);

  return null;
}
