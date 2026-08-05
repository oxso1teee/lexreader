"use client";

import { useState } from "react";
import PdfImportForm from "./pdf-import-form";
import PhotoImportForm from "./photo-import-form";
import type { CollectionOption } from "./collection-picker";

// M3 Slice 3: artifact groups PDF and photo under one "Файл" entry point —
// backend/extraction logic for each stays completely separate (different
// libraries, different validation), only the tab grouping changes.
export default function FileImportTabs({
  targetLanguage,
  canAddText,
  collections,
}: {
  targetLanguage: string;
  canAddText: boolean;
  collections: CollectionOption[];
}) {
  const [kind, setKind] = useState<"pdf" | "photo">("pdf");

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex gap-2 px-5 pt-4" role="group" aria-label="Тип файла">
        <button
          type="button"
          onClick={() => setKind("pdf")}
          aria-pressed={kind === "pdf"}
          className={`focus-ring min-h-9 rounded-full border px-3.5 text-xs font-bold ${
            kind === "pdf"
              ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-white"
              : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)]"
          }`}
        >
          PDF
        </button>
        <button
          type="button"
          onClick={() => setKind("photo")}
          aria-pressed={kind === "photo"}
          className={`focus-ring min-h-9 rounded-full border px-3.5 text-xs font-bold ${
            kind === "photo"
              ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-white"
              : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)]"
          }`}
        >
          Фото
        </button>
      </div>
      {kind === "pdf" ? (
        <PdfImportForm targetLanguage={targetLanguage} canAddText={canAddText} collections={collections} />
      ) : (
        <PhotoImportForm targetLanguage={targetLanguage} canAddText={canAddText} collections={collections} />
      )}
    </div>
  );
}
