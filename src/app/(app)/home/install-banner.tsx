"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const VISIT_KEY = "lexreader_visit_count";
const DISMISSED_KEY = "lexreader_install_dismissed";
const MIN_VISITS_BEFORE_PROMPT = 3;

// Раздел 5 промта 2026-07-30 (запуск): манифест и service worker уже
// готовы, но ничего не предлагает установку — вся эта работа была
// невидима для пользователя.
export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(DISMISSED_KEY)) return;
    const visits = Number(window.localStorage.getItem(VISIT_KEY) ?? "0") + 1;
    window.localStorage.setItem(VISIT_KEY, String(visits));
    if (visits < MIN_VISITS_BEFORE_PROMPT) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    await prompt.prompt();
    setVisible(false);
    window.localStorage.setItem(DISMISSED_KEY, "1");
  }

  function handleDismiss() {
    setVisible(false);
    window.localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-black p-3.5 text-white dark:bg-white dark:text-black">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-caramel text-lg">
        📲
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Установи LexReader</p>
        <p className="text-xs opacity-70">Заниматься с домашнего экрана, без браузера</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium dark:border-black/20"
      >
        Не сейчас
      </button>
      <button
        type="button"
        onClick={handleInstall}
        className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-black dark:bg-black dark:text-white"
      >
        Установить
      </button>
    </div>
  );
}
