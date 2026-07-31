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
export default function HapticsToggle() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    localStorage.setItem(KEY, enabled ? "false" : "true");
    listeners.forEach((l) => l());
  }

  return (
    <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <h2 className="mb-2 font-medium">Ощущения</h2>
      <label className="flex items-center justify-between text-sm">
        <span>Вибрация при ответах в Мозге</span>
        <input type="checkbox" checked={enabled} onChange={toggle} className="h-5 w-5" />
      </label>
    </section>
  );
}
