"use client";

import { useSyncExternalStore } from "react";

const KEY = "lexreader_haptics_enabled";
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  return localStorage.getItem(KEY) !== "false";
}
function getServerSnapshot(): boolean {
  return true;
}
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

// Раздел 5 промта 2026-07-30 (полировка): настройка вибро-отклика — только
// на устройстве (localStorage), не в аккаунте.
//
// Экран 11/11 редизайна: тот же паттерн строки-переключателя, что и
// theme-toggle.tsx (двухпозиционный сегмент вместо голого <input
// type="checkbox">), а не собственная карточка-секция — settings-client.tsx
// собирает обе строки в одну карточку "Оформление и устройство".
export default function HapticsToggle() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function select(next: boolean) {
    localStorage.setItem(KEY, next ? "true" : "false");
    listeners.forEach((l) => l());
  }

  return (
    <div>
      <p className="text-body-sm mb-1.5 text-[var(--text-secondary)]">Вибрация при ответах в Мозге</p>
      <div role="group" aria-label="Вибрация при ответах" className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => select(true)}
          className={`focus-ring flex min-h-11 items-center justify-center rounded-lg border text-body-sm font-medium transition-colors ${
            enabled ? "border-forest bg-forest text-white" : "border-[var(--border-strong)]"
          }`}
        >
          Включена
        </button>
        <button
          type="button"
          aria-pressed={!enabled}
          onClick={() => select(false)}
          className={`focus-ring flex min-h-11 items-center justify-center rounded-lg border text-body-sm font-medium transition-colors ${
            !enabled ? "border-forest bg-forest text-white" : "border-[var(--border-strong)]"
          }`}
        >
          Выключена
        </button>
      </div>
    </div>
  );
}
