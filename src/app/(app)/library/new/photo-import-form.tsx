"use client";

import { useActionState, useState } from "react";
import { createWorker } from "tesseract.js";
import { createText, type CreateTextState } from "../actions";
import { TESSERACT_LANG } from "@/lib/ocr-lang-map";
import { validateImageFile } from "@/lib/file-validation";
import { log } from "@/lib/log";
import PaywallNotice from "./paywall-notice";

export default function PhotoImportForm({ targetLanguage }: { targetLanguage: string }) {
  const [state, formAction, pending] = useActionState<CreateTextState, FormData>(
    createText,
    {},
  );
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

  if (state.paywall) {
    return <PaywallNotice />;
  }

  if (!text) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-5 py-6">
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/20 px-4 py-10 text-center text-black/60 hover:border-black/40 dark:border-white/20 dark:text-white/60 dark:hover:border-white/40">
          <span>Сфотографируй или выбери фото с текстом</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>
        {status === "working" && (
          <p className="text-sm text-black/50 dark:text-white/50">Распознаём текст… {progress}%</p>
        )}
        {ocrError && <p className="text-sm text-red-600 dark:text-red-400">{ocrError}</p>}
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
        placeholder="Распознанный текст (проверь и поправь ошибки OCR)"
        className="w-full flex-1 resize-none rounded-lg border border-black/10 px-4 py-3 text-base leading-7 outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <p className="text-xs text-black/40 dark:text-white/40">
        Распознавание не идеально — проверь текст перед сохранением.
      </p>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setText("")}
          className="rounded-full border border-black/10 px-5 py-3 font-medium dark:border-white/15"
        >
          Другое фото
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
