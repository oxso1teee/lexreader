"use client";

import { useState } from "react";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { createText } from "../actions";
import { useAddMaterialAction } from "./use-add-material-action";
import { validatePdfFile } from "@/lib/file-validation";
import { log } from "@/lib/log";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";
import { useIsNativePlatform } from "@/lib/use-is-native";

// M3 Slice 3 fix: pdfjs-dist's own module (canvas.js) runs `new DOMMatrix()`
// as a module-evaluation side effect — a static top-level import (as this
// file always had, pre-dating this slice) makes Next.js try to evaluate that
// during SSR, where DOMMatrix doesn't exist, crashing the whole route render
// (confirmed via dev server logs: "ReferenceError: DOMMatrix is not defined"
// on every /library/new request). A dynamic import confined to the
// click-triggered handler never runs outside the browser.
let pdfjsLibPromise: ReturnType<typeof loadPdfjs> | null = null;
function loadPdfjs() {
  return import("pdfjs-dist").then((mod) => {
    mod.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return mod;
  });
}

// Держим в разумных пределах: очень длинные книги всё равно режутся тем же
// лимитом, что и импорт по URL (actions.ts проверяет body.length <= 200_000).
const MAX_PDF_PAGES = 300;
const MAX_PDF_BODY_LENGTH = 200_000;

export default function PdfImportForm({
  targetLanguage,
  canAddText,
  collections,
}: {
  targetLanguage: string;
  canAddText: boolean;
  collections: CollectionOption[];
}) {
  const [state, formAction, pending] = useAddMaterialAction("file_pdf", createText, {});
  const isNative = useIsNativePlatform();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  async function handleFile(file: File) {
    const validationError = await validatePdfFile(file);
    if (validationError) {
      setPdfError(validationError);
      setStatus("error");
      return;
    }

    setStatus("working");
    setProgress(0);
    setPdfError(null);
    setText("");

    try {
      if (!pdfjsLibPromise) pdfjsLibPromise = loadPdfjs();
      const pdfjsLib = await pdfjsLibPromise;
      const data = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
      const parts: string[] = [];

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ("str" in item ? (item as TextItem).str : ""))
          .join(" ")
          .trim();
        if (pageText) parts.push(pageText);
        setProgress(Math.round((i / pageCount) * 100));
      }

      const combined = parts.join("\n\n").trim().slice(0, MAX_PDF_BODY_LENGTH);
      if (!combined) {
        log.import({ kind: "pdf_text", outcome: "error", reason: "no_text_layer" });
        setPdfError(
          "Не нашли текст в этом PDF — похоже, это скан без текстового слоя. Попробуй импорт через «Фото».",
        );
        setStatus("error");
        return;
      }

      setText(combined);
      setTitle(file.name.replace(/\.pdf$/i, ""));
      setStatus("idle");
    } catch {
      log.import({ kind: "pdf_text", outcome: "error", reason: "parse_exception" });
      setPdfError("Не удалось прочитать этот PDF. Попробуй другой файл.");
      setStatus("error");
    }
  }

  if (!canAddText && !text) {
    return <PaywallNotice />;
  }

  if (!text) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <label className="focus-within:border-[var(--color-forest)] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-10 text-center text-[var(--text-secondary)] hover:border-[var(--color-forest)]">
          <span className="font-semibold">Выбери PDF-файл</span>
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        <p className="text-xs text-[var(--text-secondary)]">
          Работает с текстовым слоем PDF (не со сканами) — целевой язык: {targetLanguage}. До 20 МБ.
        </p>
        {status === "working" && (
          <div className="flex flex-col gap-1.5" aria-live="polite">
            <p className="text-sm text-[var(--text-secondary)]">Читаем PDF… {progress}%</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div className="h-full rounded-full bg-[var(--color-forest)] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {pdfError && (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {pdfError}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pdf-import-title" className="text-sm font-semibold">
          Название
        </label>
        <input
          id="pdf-import-title"
          type="text"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название текста"
          className="focus-ring w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2.5 text-base outline-none"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="pdf-import-body" className="text-sm font-semibold">
          Текст из PDF
        </label>
        <textarea
          id="pdf-import-body"
          name="body"
          required
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст, извлечённый из PDF"
          className="focus-ring w-full flex-1 resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-base leading-7 outline-none"
        />
        <p className="text-xs text-[var(--text-secondary)]">
          Проверь текст перед сохранением — разметка страниц PDF иногда ломает порядок слов.
        </p>
      </div>
      <CollectionPicker collections={collections} />
      {state.error && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {state.error}
        </p>
      )}
      {state.paywall && (
        <p className="text-sm text-[var(--text-secondary)]">
          {isNative ? (
            "Лимит бесплатного тарифа по текстам исчерпан. Текст ниже сохранён."
          ) : (
            <>
              Лимит бесплатного тарифа по текстам исчерпан.{" "}
              <a href="/paywall?reason=texts" className="focus-ring font-semibold text-[var(--color-caramel-text)] underline">
                Смотреть Premium
              </a>
              . Текст ниже сохранён — можно оформить Premium и сохранить его после.
            </>
          )}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setText("")}
          className="focus-ring min-h-11 rounded-full border border-[var(--border-strong)] px-5 py-3 font-semibold"
        >
          Другой файл
        </button>
        <button
          type="submit"
          disabled={pending}
          className="focus-ring min-h-11 flex-1 rounded-full bg-[var(--color-forest)] px-5 py-3 font-bold text-white transition-colors hover:bg-[var(--color-forest-deep)] disabled:opacity-50"
        >
          {pending ? "Сохраняем…" : "Добавить в библиотеку"}
        </button>
      </div>
    </form>
  );
}
