"use client";

import { useSyncExternalStore } from "react";
import {
  DEFAULT_READER_PREFS,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  MIN_LINE_HEIGHT,
  MAX_LINE_HEIGHT,
  parseReaderPrefs,
  type ReaderPrefs,
  type ReadingTheme,
} from "./reader-prefs";

export type { ReadingTheme, ReadingWidth, ReaderPrefs } from "./reader-prefs";
export { DEFAULT_READER_PREFS, READING_WIDTH_PX } from "./reader-prefs";

const STORAGE_KEY = "lexreader_reader_prefs";

// Раздел 5 промта 2026-07-30 (запуск): читалка изначально была одним
// фиксированным размером/фоном для всех — настройки хранились только в
// localStorage. M3 Slice 3 §8: profiles.reader_settings добавляет
// account-sync поверх этого же localStorage-кэша (see adoptServerReaderPrefs
// in reader.tsx) — localStorage остаётся мгновенным/офлайн-источником,
// сервер — источником для синхронизации между устройствами.
export function loadReaderPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return DEFAULT_READER_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READER_PREFS;
    return parseReaderPrefs(JSON.parse(raw));
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

export function saveReaderPrefs(prefs: ReaderPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// useSyncExternalStore (не useState+useEffect) — так сервер и первый
// клиентский рендер честно совпадают на DEFAULT_READER_PREFS без гидратационного
// расхождения, а значение из localStorage подставляется отдельным, уже
// клиентским шагом, без setState внутри эффекта.
let currentPrefs: ReaderPrefs = DEFAULT_READER_PREFS;
let initialized = false;
const listeners = new Set<() => void>();

function getSnapshot(): ReaderPrefs {
  if (!initialized) {
    currentPrefs = loadReaderPrefs();
    initialized = true;
  }
  return currentPrefs;
}

function getServerSnapshot(): ReaderPrefs {
  return DEFAULT_READER_PREFS;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

export function useReaderPrefs(): [ReaderPrefs, (next: ReaderPrefs) => void] {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setPrefs(next: ReaderPrefs) {
    currentPrefs = next;
    initialized = true;
    saveReaderPrefs(next);
    listeners.forEach((l) => l());
  }

  return [prefs, setPrefs];
}

// Called once on Reader mount when the server (profiles.reader_settings)
// has a real saved value — adopts it as this device's current prefs so a
// setting changed on another device shows up here too. A no-op call (same
// value already active) still notifies listeners harmlessly.
export function adoptServerReaderPrefs(prefs: ReaderPrefs): void {
  currentPrefs = prefs;
  initialized = true;
  saveReaderPrefs(prefs);
  listeners.forEach((l) => l());
}

const THEME_SWATCHES: { value: ReadingTheme; label: string; bg: string; fg: string }[] = [
  { value: "paper", label: "Бумага", bg: "#f7f4ee", fg: "#1a1a1a" },
  { value: "sepia", label: "Сепия", bg: "#f2e6cf", fg: "#5c4326" },
  { value: "dark", label: "Тёмная", bg: "#1c1a16", fg: "#e8e2d4" },
];

export default function ReaderSettings({
  prefs,
  onChange,
  onClose,
}: {
  prefs: ReaderPrefs;
  onChange: (prefs: ReaderPrefs) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-2xl bg-[var(--surface)] p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3">Настройки чтения</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="focus-ring text-[var(--text-secondary)]">
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-semibold">Размер текста</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Уменьшить текст"
              onClick={() => onChange({ ...prefs, fontSize: Math.max(MIN_FONT_SIZE, prefs.fontSize - 1) })}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] font-bold"
            >
              A−
            </button>
            <span className="w-10 text-center text-sm">{prefs.fontSize}px</span>
            <button
              type="button"
              aria-label="Увеличить текст"
              onClick={() => onChange({ ...prefs, fontSize: Math.min(MAX_FONT_SIZE, prefs.fontSize + 1) })}
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] font-bold"
            >
              A+
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-semibold">Межстрочный интервал</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Уменьшить интервал"
              onClick={() =>
                onChange({ ...prefs, lineHeight: Math.max(MIN_LINE_HEIGHT, Math.round((prefs.lineHeight - 0.1) * 10) / 10) })
              }
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] font-bold"
            >
              −
            </button>
            <span className="w-10 text-center text-sm">{prefs.lineHeight.toFixed(1)}</span>
            <button
              type="button"
              aria-label="Увеличить интервал"
              onClick={() =>
                onChange({ ...prefs, lineHeight: Math.min(MAX_LINE_HEIGHT, Math.round((prefs.lineHeight + 0.1) * 10) / 10) })
              }
              className="focus-ring flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-muted)] font-bold"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-semibold">Ширина текста</span>
          <div className="flex gap-2" role="group" aria-label="Ширина текста">
            <button
              type="button"
              aria-pressed={prefs.width === "narrow"}
              onClick={() => onChange({ ...prefs, width: "narrow" })}
              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${prefs.width === "narrow" ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-white" : "border-[var(--border-strong)]"}`}
            >
              Узкая
            </button>
            <button
              type="button"
              aria-pressed={prefs.width === "wide"}
              onClick={() => onChange({ ...prefs, width: "wide" })}
              className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold ${prefs.width === "wide" ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-white" : "border-[var(--border-strong)]"}`}
            >
              Широкая
            </button>
          </div>
        </div>

        <div className="py-2">
          <p className="mb-2 text-sm font-semibold">Фон</p>
          <div className="flex gap-2">
            {THEME_SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={prefs.theme === s.value}
                onClick={() => onChange({ ...prefs, theme: s.value })}
                style={{ background: s.bg, color: s.fg }}
                className={`focus-ring flex h-11 flex-1 items-center justify-center rounded-lg text-xs font-semibold ${
                  prefs.theme === s.value ? "ring-2 ring-[var(--color-forest)] ring-offset-2 ring-offset-[var(--surface)]" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onChange(DEFAULT_READER_PREFS)}
          className="focus-ring mt-3 min-h-11 w-full rounded-lg border border-[var(--border-strong)] text-sm font-semibold text-[var(--text-secondary)]"
        >
          Сбросить настройки
        </button>
      </div>
    </div>
  );
}
