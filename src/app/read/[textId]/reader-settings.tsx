"use client";

import { useSyncExternalStore } from "react";

export type ReadingTheme = "paper" | "sepia" | "dark";

export interface ReaderPrefs {
  fontSize: number;
  lineHeight: number;
  theme: ReadingTheme;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = { fontSize: 18, lineHeight: 1.9, theme: "paper" };

const STORAGE_KEY = "lexreader_reader_prefs";
const MIN_FONT_SIZE = 15;
const MAX_FONT_SIZE = 24;
const MIN_LINE_HEIGHT = 1.5;
const MAX_LINE_HEIGHT = 2.2;

// Раздел 5 промта 2026-07-30 (запуск): читалка была одним фиксированным
// размером/фоном для всех — настройки хранятся только в localStorage,
// не в базе (это предпочтение конкретного устройства, не аккаунта).
export function loadReaderPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return DEFAULT_READER_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_READER_PREFS;
    const parsed = JSON.parse(raw);
    return {
      fontSize: typeof parsed.fontSize === "number" ? parsed.fontSize : DEFAULT_READER_PREFS.fontSize,
      lineHeight: typeof parsed.lineHeight === "number" ? parsed.lineHeight : DEFAULT_READER_PREFS.lineHeight,
      theme: ["paper", "sepia", "dark"].includes(parsed.theme) ? parsed.theme : DEFAULT_READER_PREFS.theme,
    };
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
        className="w-full max-w-sm rounded-t-2xl bg-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold">Настройки чтения</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-black/40 dark:text-white/40">
            ✕
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">Размер текста</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Уменьшить текст"
              onClick={() => onChange({ ...prefs, fontSize: Math.max(MIN_FONT_SIZE, prefs.fontSize - 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 font-bold dark:bg-white/10"
            >
              A−
            </button>
            <span className="w-10 text-center text-sm">{prefs.fontSize}px</span>
            <button
              type="button"
              aria-label="Увеличить текст"
              onClick={() => onChange({ ...prefs, fontSize: Math.min(MAX_FONT_SIZE, prefs.fontSize + 1) })}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 font-bold dark:bg-white/10"
            >
              A+
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium">Межстрочный интервал</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Уменьшить интервал"
              onClick={() =>
                onChange({ ...prefs, lineHeight: Math.max(MIN_LINE_HEIGHT, Math.round((prefs.lineHeight - 0.1) * 10) / 10) })
              }
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 font-bold dark:bg-white/10"
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 font-bold dark:bg-white/10"
            >
              +
            </button>
          </div>
        </div>

        <div className="py-2">
          <p className="mb-2 text-sm font-medium">Фон</p>
          <div className="flex gap-2">
            {THEME_SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange({ ...prefs, theme: s.value })}
                style={{ background: s.bg, color: s.fg }}
                className={`flex h-11 flex-1 items-center justify-center rounded-lg text-xs font-semibold ${
                  prefs.theme === s.value ? "ring-2 ring-caramel ring-offset-2 ring-offset-card" : ""
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
