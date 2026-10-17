"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

// Нативная обёртка (Capacitor, remote-URL режим) загружает этот же сайт, но
// без доводки он ведёт себя как страница в браузере. Компонент ничего не
// рисует — только:
//  - ставит класс `native-app` на <html> (CSS в globals.css отключает
//    резиновый оверскролл, подсветку тапа и т.п. именно для приложения);
//  - красит статус-бар под текущую тему и следит за её переключением;
//  - убирает сплэш, как только страница ожила;
//  - делает аппаратную кнопку «Назад» Android навигацией по истории, а не
//    мгновенным выходом из приложения.
// В обычном браузере и PWA компонент не делает ничего.
export default function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const root = document.documentElement;
    root.classList.add("native-app");
    root.dataset.platform = Capacitor.getPlatform();

    let disposed = false;
    const cleanups: Array<() => void> = [];

    (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        const applyStatusBar = () => {
          const dark = root.dataset.theme === "dark";
          // Style.Dark = светлый текст статус-бара (для тёмного фона).
          void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
          if (Capacitor.getPlatform() === "android") {
            void StatusBar.setBackgroundColor({ color: dark ? "#14120f" : "#f5f1ea" }).catch(() => {});
          }
        };
        applyStatusBar();
        const observer = new MutationObserver(applyStatusBar);
        observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
        cleanups.push(() => observer.disconnect());
      } catch {
        // Плагин не синхронизирован с нативным проектом — не критично.
      }

      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 200 });
      } catch {}

      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack || window.history.length > 1) {
            window.history.back();
          } else {
            void App.exitApp();
          }
        });
        if (disposed) void handle.remove();
        else cleanups.push(() => void handle.remove());
      } catch {}
    })();

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return null;
}
