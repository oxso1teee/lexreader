// Pure types/logic shared between the Server Component (page.tsx, reads
// profiles.reader_settings) and the client store (reader-settings.tsx,
// reads localStorage) — kept out of a "use client" file so page.tsx can
// import it directly (Next.js only exposes component exports, not plain
// functions, from "use client" modules to Server Components).
export type ReadingTheme = "paper" | "sepia" | "dark";
export type ReadingWidth = "narrow" | "wide";

export interface ReaderPrefs {
  fontSize: number;
  lineHeight: number;
  theme: ReadingTheme;
  width: ReadingWidth;
}

// Reader mockup alignment — lineHeight default 1.9 -> 1.85 (референс),
// fontSize/MIN/MAX/theme/width не тронуты: та же регулировка размера
// шрифта пользователем, что и была, просто пересчитанная база под новый
// шрифт тела текста (Source Serif 4, см. --font-reading в tokens.css) —
// настройка не удалена, значение по умолчанию просто соответствует
// новому шрифту точнее, чем старое (было подобрано под Playfair Display).
export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 18,
  lineHeight: 1.85,
  theme: "paper",
  width: "narrow",
};

// docs/release-2026-08-26/12_VIZUALNAYA_IDENTICHNOST_RESHENIE_2026-08-26.md
// "комфортная ширина колонки" — 820/1040 at the default 18px font size
// (plus the article's own px-5/sm:px-9 padding) worked out to roughly
// 83-108 characters per line, well past the ~45-75ch range typography
// guidance (Bringhurst) treats as comfortable for sustained reading.
// 680/860 keeps the same two-option narrow/wide choice but both land
// close to that range instead of one comfortable-ish and one too wide.
export const READING_WIDTH_PX: Record<ReadingWidth, number> = { narrow: 680, wide: 860 };

export const MIN_FONT_SIZE = 15;
export const MAX_FONT_SIZE = 24;
export const MIN_LINE_HEIGHT = 1.5;
export const MAX_LINE_HEIGHT = 2.2;

// Never throws — an empty/malformed value (e.g. profiles.reader_settings'
// default '{}') falls back field-by-field to DEFAULT_READER_PREFS.
export function parseReaderPrefs(raw: unknown): ReaderPrefs {
  const parsed = (raw ?? {}) as Record<string, unknown>;
  const fontSize =
    typeof parsed.fontSize === "number"
      ? Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, parsed.fontSize))
      : DEFAULT_READER_PREFS.fontSize;
  const lineHeight =
    typeof parsed.lineHeight === "number"
      ? Math.min(MAX_LINE_HEIGHT, Math.max(MIN_LINE_HEIGHT, parsed.lineHeight))
      : DEFAULT_READER_PREFS.lineHeight;
  const theme = ["paper", "sepia", "dark"].includes(parsed.theme as string)
    ? (parsed.theme as ReadingTheme)
    : DEFAULT_READER_PREFS.theme;
  const width = ["narrow", "wide"].includes(parsed.width as string)
    ? (parsed.width as ReadingWidth)
    : DEFAULT_READER_PREFS.width;
  return { fontSize, lineHeight, theme, width };
}

// True when the raw JSONB value actually carries a saved preference (not
// the migration's empty-object default) — used to decide whether a
// server-synced value should override this device's localStorage.
export function hasSavedReaderPrefs(raw: unknown): boolean {
  return !!raw && typeof raw === "object" && Object.keys(raw as object).length > 0;
}
