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

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  fontSize: 18,
  lineHeight: 1.9,
  theme: "paper",
  width: "narrow",
};

export const READING_WIDTH_PX: Record<ReadingWidth, number> = { narrow: 820, wide: 1040 };

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
