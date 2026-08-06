"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { importFlashcards } from "./actions";
import { FREE_FLASHCARD_LIMIT } from "@/lib/subscription";
import { TESSERACT_LANG } from "@/lib/ocr-lang-map";
import { validateImageFile } from "@/lib/file-validation";
import { log } from "@/lib/log";
import { parseImportCards } from "@/lib/import-cards";

interface ParsedCard {
  front: string;
  back: string;
  notes?: string;
}

interface Deck {
  id: string;
  name: string;
}

async function parseFile(file: File): Promise<ParsedCard[]> {
  if (file.size > 2_000_000) {
    throw new Error("Файл слишком большой — максимум 2 МБ.");
  }
  const text = await file.text();
  return parseImportCards(file.name, text);
}

function splitOcrLine(line: string): ParsedCard {
  const delimiters = ["\t", " — ", " – ", " - ", ":", ","];
  for (const d of delimiters) {
    const idx = line.indexOf(d);
    if (idx > 0) {
      return { front: line.slice(0, idx).trim(), back: line.slice(idx + d.length).trim() };
    }
  }
  return { front: line.trim(), back: "" };
}

export default function ImportModal({
  decks,
  defaultDeckId,
  targetLanguage,
}: {
  decks: Deck[];
  defaultDeckId?: string;
  targetLanguage: string;
}) {
  const [open, setOpen] = useState(false);
  const [deckId, setDeckId] = useState(defaultDeckId ?? decks[0]?.id ?? "");
  const [cards, setCards] = useState<ParsedCard[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function reset() {
    setCards([]);
    setError(null);
    setResult(null);
  }

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        log.import({ kind: "csv_json", outcome: "error", reason: "no_rows_parsed" });
        setError("В файле не нашлось ни одной карточки — проверь формат (front,back,notes).");
        return;
      }
      log.import({ kind: "csv_json", outcome: "success" });
      setCards(parsed);
    } catch (cause) {
      log.import({ kind: "csv_json", outcome: "error", reason: "parse_exception" });
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось прочитать файл — проверь формат и содержимое.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(file: File) {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setProgress(0);
    setError(null);
    try {
      const lang = TESSERACT_LANG[targetLanguage] ?? "eng";
      const worker = await createWorker(lang, undefined, {
        logger: (m) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      const parsed = text
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map(splitOcrLine);

      if (parsed.length === 0) {
        log.import({ kind: "photo_cards", outcome: "error", reason: "empty_ocr_result" });
        setError(
          "Не нашли текст на этом фото. Проверь, что фото чёткое, хорошо освещено и текст на нём читаем.",
        );
        return;
      }
      log.import({ kind: "photo_cards", outcome: "success" });
      setCards(parsed);
    } catch {
      log.import({ kind: "photo_cards", outcome: "error", reason: "ocr_exception" });
      setError("Не удалось распознать фото. Попробуй другое фото.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!deckId || cards.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await importFlashcards(deckId, cards);
    setBusy(false);
    if (!res.ok) {
      setError(
        res.paywall
          ? `На бесплатном тарифе можно держать до ${FREE_FLASHCARD_LIMIT} карточек — оформи Premium, чтобы импортировать больше.`
          : (res.error ?? "Не удалось импортировать."),
      );
      return;
    }
    setResult(
      res.skippedDuplicates
        ? `Импортировано карточек: ${res.count} · пропущено дублей: ${res.skippedDuplicates}`
        : `Импортировано карточек: ${res.count}`,
    );
    setCards([]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-black/20 px-4 py-2 text-sm font-medium dark:border-white/25"
      >
        📁 Импорт
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5">
        <h2 className="mb-4 text-center text-lg font-bold">Импорт карточек</h2>

        {result ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p>{result}</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="rounded-full bg-caramel px-5 py-2.5 font-medium text-black"
            >
              Готово
            </button>
          </div>
        ) : cards.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-black/60 dark:text-white/60">
              Найдено карточек: {cards.length}. Проверь и поправь при необходимости.
            </p>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {cards.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={c.front}
                    onChange={(e) =>
                      setCards((cs) => cs.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))
                    }
                    className="w-1/2 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20"
                  />
                  <input
                    value={c.back}
                    onChange={(e) =>
                      setCards((cs) => cs.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))
                    }
                    className="w-1/2 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20"
                  />
                  <button
                    type="button"
                    onClick={() => setCards((cs) => cs.filter((_, j) => j !== i))}
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-red-500"
                    aria-label="Удалить"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <label htmlFor="import-deck" className="text-sm font-medium">
              Колода
            </label>
            <select
              id="import-deck"
              value={deckId}
              onChange={(e) => setDeckId(e.target.value)}
              className="rounded-lg border border-black/20 px-3 py-2 dark:border-white/25 dark:bg-transparent"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-full bg-black/10 py-2.5 font-medium dark:bg-white/10"
              >
                Назад
              </button>
              <button
                type="button"
                disabled={busy || !deckId}
                onClick={handleImport}
                className="flex-1 rounded-full bg-caramel py-2.5 font-medium text-black disabled:opacity-50"
              >
                {busy ? "…" : "Импортировать"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">1. Выберите источник</p>
            <label className="cursor-pointer rounded-lg border border-black/20 px-4 py-3 text-center dark:border-white/25">
              📁 Выбрать файл с карточками
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>
            <label className="cursor-pointer rounded-lg border border-black/20 px-4 py-3 text-center dark:border-white/25">
              📸 Импорт с фото (OCR)
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhoto(file);
                }}
              />
            </label>
            <p className="text-center text-xs text-[var(--text-secondary)]">
              CSV/TSV/TXT/JSON • Обязательны фраза и перевод • HTML-страницы не поддерживаются
            </p>
            <details className="rounded-lg bg-black/5 px-3 py-2 text-xs dark:bg-white/5">
              <summary className="cursor-pointer font-medium">Поддерживаемые форматы и примеры</summary>
              <div className="mt-2 space-y-2 text-black/60 dark:text-white/60">
                <p>
                  CSV: <code>phrase,translation,notes</code>
                </p>
                <p>
                  TSV/TXT: <code>Good morning.&#9;Доброе утро.</code>
                </p>
                <p>
                  JSON: <code>{`[{"front":"Good morning.","back":"Доброе утро."}]`}</code>
                </p>
                <p>Также понимаются названия колонок front/back и разделитель «;».</p>
              </div>
            </details>
            {busy && (
              <p className="text-center text-sm text-[var(--text-secondary)]">
                {progress > 0 ? `Распознаём текст… ${progress}%` : "Обрабатываем…"}
              </p>
            )}
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="mt-1 rounded-full bg-black/10 py-2.5 font-medium dark:bg-white/10"
            >
              Отмена
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
