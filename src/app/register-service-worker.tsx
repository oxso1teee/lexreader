"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// PWA-манифест + offline app-shell (P0-MOB-01..03) работают независимо от
// push-уведомлений — регистрируем service worker сразу, а не только при
// включении пушей (см. settings-client.tsx, который переиспользует эту же
// регистрацию через navigator.serviceWorker.ready).
export default function RegisterServiceWorker() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Офлайн-кеш — необязательное улучшение, не критично для работы приложения.
      });
    }
  }, []);

  useEffect(() => {
    // Баг "на телефоне старая версия / нет только что добавленной книги":
    // sw.js делает network-first для навигаций, но если фетч не удался (типичный
    // случай — PWA открыли с домашнего экрана до того, как телефон восстановил
    // Wi-Fi/LTE), он молча отдаёт последний УСПЕШНО закешированный снимок
    // страницы — без каких-либо признаков того, что данные устарели, и без
    // повторной попытки. Пользователь остаётся смотреть на библиотеку без
    // текста, добавленного с ноутбука, и это никогда само не исправляется.
    // Как только вкладка снова online или пользователь возвращается в
    // свёрнутое/отложенное PWA — тихо перезапрашиваем данные текущего
    // маршрута. router.refresh() перерисовывает только серверные компоненты
    // (аналог revalidateOnFocus у SWR/React Query), не сбрасывая то, что
    // человек уже успел ввести в форму, в отличие от полного location.reload().
    const revalidate = () => router.refresh();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") revalidate();
    };

    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [router]);

  return null;
}
