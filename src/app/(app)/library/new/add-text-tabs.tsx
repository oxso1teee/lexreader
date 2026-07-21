"use client";

import { useState } from "react";
import NewTextForm from "./new-text-form";
import UrlImportForm from "./url-import-form";
import YoutubeImportForm from "./youtube-import-form";
import PhotoImportForm from "./photo-import-form";

const MODES = [
  { value: "text", label: "Текст" },
  { value: "url", label: "Ссылка" },
  { value: "youtube", label: "YouTube" },
  { value: "photo", label: "Фото" },
] as const;

type Mode = (typeof MODES)[number]["value"];

export default function AddTextTabs({ targetLanguage }: { targetLanguage: string }) {
  const [mode, setMode] = useState<Mode>("text");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 border-b border-black/10 px-5 pt-2 dark:border-white/10">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
              mode === m.value
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "text" && <NewTextForm />}
      {mode === "url" && <UrlImportForm />}
      {mode === "youtube" && <YoutubeImportForm />}
      {mode === "photo" && <PhotoImportForm targetLanguage={targetLanguage} />}
    </div>
  );
}
