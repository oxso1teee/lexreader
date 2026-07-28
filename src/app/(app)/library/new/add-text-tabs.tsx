"use client";

import { useState } from "react";
import NewTextForm from "./new-text-form";
import UrlImportForm from "./url-import-form";
import YoutubeImportForm from "./youtube-import-form";
import PhotoImportForm from "./photo-import-form";
import PdfImportForm from "./pdf-import-form";
import type { CollectionOption } from "./collection-picker";

const MODES = [
  { value: "text", label: "Текст" },
  { value: "url", label: "Ссылка" },
  { value: "youtube", label: "YouTube" },
  { value: "photo", label: "Фото" },
  { value: "pdf", label: "PDF" },
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
      <div className="flex gap-2 border-b border-black/10 px-5 pt-2 dark:border-white/10">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`-mb-px flex min-h-11 items-center border-b-2 px-2 text-sm font-medium transition-colors ${
              mode === m.value
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
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
      {mode === "photo" && (
        <PhotoImportForm
          targetLanguage={targetLanguage}
          canAddText={canAddText}
          collections={collections}
        />
      )}
      {mode === "pdf" && (
        <PdfImportForm
          targetLanguage={targetLanguage}
          canAddText={canAddText}
          collections={collections}
        />
      )}
    </div>
  );
}
