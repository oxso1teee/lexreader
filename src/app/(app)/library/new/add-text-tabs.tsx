"use client";

import { useState } from "react";
import NewTextForm from "./new-text-form";
import UrlImportForm from "./url-import-form";
import YoutubeImportForm from "./youtube-import-form";
import FileImportTabs from "./file-import-tabs";
import TranscriptImportForm from "./transcript-import-form";
import type { CollectionOption } from "./collection-picker";

// M3 Slice 3 approved artifact: 5 entry points. "Файл" groups PDF+photo
// under one tab (see file-import-tabs.tsx); "Транскрипт" reuses the same
// createText action as "Текст" — see transcript-import-form.tsx.
const MODES = [
  { value: "text", label: "Текст" },
  { value: "file", label: "Файл" },
  { value: "youtube", label: "YouTube" },
  { value: "url", label: "Сайт" },
  { value: "transcript", label: "Транскрипт" },
] as const;

type Mode = (typeof MODES)[number]["value"];

export default function AddTextTabs({
  targetLanguage,
  canAddText,
  collections,
}: {
  targetLanguage: string;
  canAddText: boolean;
  collections: CollectionOption[];
}) {
  const [mode, setMode] = useState<Mode>("text");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-5 pt-2" role="tablist" aria-label="Способ добавления">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            onClick={() => setMode(m.value)}
            className={`focus-ring -mb-px flex min-h-11 items-center whitespace-nowrap border-b-2 px-2.5 text-sm font-bold transition-colors ${
              mode === m.value
                ? "border-[var(--color-forest)] text-[var(--color-forest-text)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--color-forest-text)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "text" && <NewTextForm collections={collections} />}
      {mode === "url" && <UrlImportForm collections={collections} />}
      {mode === "youtube" && (
        <YoutubeImportForm targetLanguage={targetLanguage} collections={collections} />
      )}
      {mode === "file" && (
        <FileImportTabs targetLanguage={targetLanguage} canAddText={canAddText} collections={collections} />
      )}
      {mode === "transcript" && <TranscriptImportForm collections={collections} />}
    </div>
  );
}
