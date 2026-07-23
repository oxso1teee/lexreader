"use client";

import { useState } from "react";
import { createWorker } from "tesseract.js";
import { importFlashcards } from "./actions";
import { FREE_FLASHCARD_LIMIT } from "@/lib/subscription";
import { TESSERACT_LANG } from "@/lib/ocr-lang-map";
import { validateImageFile } from "@/lib/file-validation";
import { log } from "@/lib/log";

interface ParsedCard {
  front: string;
  back: string;
  notes?: string;
}

interface Deck {
  id: string;
  name: string;
}

// P0-АУДИТ (раздел 4): раньше просто .split(",") — перевод с запятой внутри
// (частый случай для фраз/идиом, особенно в кавычках "hello, how are you")
// сдвигал колонки. Минимальный парсер с поддержкой кавычек, без зависимости.
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

async function parseFile(file: File): Promise<ParsedCard[]> {
  const text = await file.text();

  if (file.name.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) {
      throw new Error("JSON должен быть массивом объектов {front, back, notes}");
    }
    return data.map((d) => ({
      front: String(d.front ?? ""),
      back: String(d.back ?? ""),
      notes: d.notes ? String(d.notes) : undefined,
    }));
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows = lines.map(parseCsvLine);
  const startIdx = rows[0]?.[0]?.trim().toLowerCase() === "front" ? 1 : 0;
  return rows.slice(startIdx).map((r) => ({
    front: (r[0] ?? "").trim(),
    back: (r[1] ?? "").trim(),
    notes: (r[2] ?? "").trim() || undefined,
  }));
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
    } catch {
      // P0-АУДИТ 3.14/3.21: не показываем сырую ошибку парсера (может быть
      // английским текстом вроде SyntaxError) — только лог для отладки.
      log.import({ kind: "csv_json", outcome: "error", reason: "parse_exception" });
      setError("Не удалось прочитать файл — проверь, что это корректный CSV или JSON.");
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
    setResult(`Импортировано карточек: ${res.count}`);
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
              className="rounded-full bg-caramel px-5 py-2.5 font-medium text-white"
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

            <label className="text-sm font-medium">Колода</label>
            <select
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
                className="flex-1 rounded-full bg-caramel py-2.5 font-medium text-white disabled:opacity-50"
              >
                {busy ? "…" : "Импортировать"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">1. Выберите источник</p>
            <label className="cursor-pointer rounded-lg border border-black/20 px-4 py-3 text-center dark:border-white/25">
              📁 Выбрать CSV или JSON файл
              <input
                type="file"
                accept=".csv,.json"
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
            <p className="text-center text-xs text-black/40 dark:text-white/40">
              CSV/JSON: формат front,back,notes • Фото: OCR распознаёт строки, раздели слово и перевод
              через « - » или запятую
            </p>
            {busy && (
              <p className="text-center text-sm text-black/50 dark:text-white/50">
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
