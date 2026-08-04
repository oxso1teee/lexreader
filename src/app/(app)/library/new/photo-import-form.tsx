"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { createText } from "../actions";
import { useAddMaterialAction } from "./use-add-material-action";
import { TESSERACT_LANG } from "@/lib/ocr-lang-map";
import { validateImageFile } from "@/lib/file-validation";
import { log } from "@/lib/log";
import PaywallNotice from "./paywall-notice";
import CollectionPicker, { type CollectionOption } from "./collection-picker";

export default function PhotoImportForm({
  targetLanguage,
  canAddText,
  collections,
}: {
  targetLanguage: string;
  canAddText: boolean;
  collections: CollectionOption[];
}) {
  const [state, formAction, pending] = useAddMaterialAction("file_photo", createText, {});
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");

  async function handleFile(file: File) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setOcrError(validationError);
      setStatus("error");
      return;
    }

    setStatus("working");
    setProgress(0);
    setOcrError(null);
    setText("");

    try {
      const lang = TESSERACT_LANG[targetLanguage] ?? "eng";
      const worker = await createWorker(lang, undefined, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const {
        data: { text: recognized },
      } = await worker.recognize(file);
      await worker.terminate();

      const trimmed = recognized.trim();
      if (!trimmed) {
        log.import({ kind: "photo_text", outcome: "error", reason: "empty_ocr_result" });
        setOcrError(
          "Не нашли текст на этом фото. Проверь, что фото чёткое, хорошо освещено и текст на нём читаем.",
        );
        setStatus("error");
        return;
      }

      setText(trimmed);
      setTitle(file.name.replace(/\.[^.]+$/, ""));
      setStatus("idle");
    } catch {
      // P0-АУДИТ 3.21: раньше сбой OCR был виден только в UI, без единого
      // следа — теперь хотя бы попадает в консоль (log.import, kind photo_text).
      log.import({ kind: "photo_text", outcome: "error", reason: "ocr_exception" });
      setOcrError("Не удалось распознать текст на фото. Попробуй другое фото.");
      setStatus("error");
    }
  }

  // Найдено при повторном аудите: лимит текстов раньше проверялся только на
  // сервере при сабмите — уже ПОСЛЕ того, как пользователь ждал долгое
  // клиентское OCR-распознавание и вручную правил результат. Проверяем
  // заранее, до того как разрешить сфотографировать/выбрать файл вообще.
  if (!canAddText && !text) {
    return <PaywallNotice />;
  }

  if (!text) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <label className="focus-within:border-[var(--color-forest)] flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-10 text-center text-[var(--text-secondary)] hover:border-[var(--color-forest)]">
          <span className="font-semibold">Сфотографируй или выбери фото с текстом</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        <p className="text-xs text-[var(--text-secondary)]">До 5 МБ. Целевой язык: {targetLanguage}.</p>
        {status === "working" && (
          <div className="flex flex-col gap-1.5" aria-live="polite">
            <p className="text-sm text-[var(--text-secondary)]">Распознаём текст… {progress}%</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div className="h-full rounded-full bg-[var(--color-forest)] transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {ocrError && (
          <p className="text-sm text-[var(--color-danger)]" role="alert">
            {ocrError}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo-import-title" className="text-sm font-semibold">
          Название
        </label>
        <input
          id="photo-import-title"
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
        <label htmlFor="photo-import-body" className="text-sm font-semibold">
          Распознанный текст
        </label>
        <textarea
          id="photo-import-body"
          name="body"
          required
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Распознанный текст (проверь и поправь ошибки OCR)"
          className="focus-ring w-full flex-1 resize-none rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3 text-base leading-7 outline-none"
        />
        <p className="text-xs text-[var(--text-secondary)]">Распознавание не идеально — проверь текст перед сохранением.</p>
      </div>
      <CollectionPicker collections={collections} />
      {state.error && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {state.error}
        </p>
      )}
      {state.paywall && (
        // Не теряем распознанный и отредактированный текст при отказе —
        // раньше здесь весь экран подменялся на PaywallNotice.
        <p className="text-sm text-[var(--text-secondary)]">
          Лимит бесплатного тарифа по текстам исчерпан.{" "}
          <a href="/paywall?reason=texts" className="focus-ring font-semibold text-[var(--color-caramel-text)] underline">
            Смотреть Premium
          </a>
          . Текст ниже сохранён — можно оформить Premium и сохранить его после.
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setText("")}
          className="focus-ring min-h-11 rounded-full border border-[var(--border-strong)] px-5 py-3 font-semibold"
        >
          Другое фото
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
