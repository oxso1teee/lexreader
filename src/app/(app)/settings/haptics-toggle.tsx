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
    <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
      <h2 className="text-h3 mb-2">Ощущения</h2>
      <label className="flex min-h-11 items-center justify-between text-body-sm">
        <span>Вибрация при ответах в Мозге</span>
        <input type="checkbox" checked={enabled} onChange={toggle} className="focus-ring h-5 w-5" />
      </label>
    </section>
  );
}
