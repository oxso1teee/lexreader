"use client";

import { useActionState, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { createText, type CreateTextState } from "../actions";
import { validatePdfFile } from "@/lib/file-validation";
import { log } from "@/lib/log";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

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
  const [state, formAction, pending] = useActionState<CreateTextState, FormData>(
    createText,
    {},
  );
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  async function handleFile(file: File) {
    const validationError = validatePdfFile(file);
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
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 px-4 py-10 text-center text-black/60 hover:border-black/40 dark:border-white/20 dark:text-white/60 dark:hover:border-white/40">
          <span>Выбери PDF-файл</span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        <p className="text-xs text-black/40 dark:text-white/40">
          Работает с текстовым слоем PDF (не со сканами) — целевой язык: {targetLanguage}.
        </p>
        {status === "working" && (
          <p className="text-sm text-black/50 dark:text-white/50">Читаем PDF… {progress}%</p>
        )}
        {pdfError && <p className="text-sm text-red-600 dark:text-red-400">{pdfError}</p>}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <input
        type="text"
        name="title"
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название текста"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <textarea
        name="body"
        required
        rows={14}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Текст, извлечённый из PDF"
        className="w-full flex-1 resize-none rounded-lg border border-black/10 px-4 py-3 text-base leading-7 outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <p className="text-xs text-black/40 dark:text-white/40">
        Проверь текст перед сохранением — разметка страниц PDF иногда ломает порядок слов.
      </p>
      <CollectionPicker collections={collections} />
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.paywall && (
        <p className="text-sm text-black/60 dark:text-white/60">
          Лимит бесплатного тарифа по текстам исчерпан.{" "}
          <a href="/paywall?reason=texts" className="text-caramel underline">
            Смотреть Premium
          </a>
          . Текст ниже сохранён — можно оформить Premium и сохранить его после.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setText("")}
          className="rounded-full border border-black/10 px-5 py-3 font-medium dark:border-white/15"
        >
          Другой файл
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {pending ? "Сохраняем…" : "Добавить в библиотеку"}
        </button>
      </div>
    </form>
  );
}
