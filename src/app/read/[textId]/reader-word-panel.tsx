"use client";

import Link from "next/link";
import { WORD_LEVELS } from "@/lib/types";

export interface Popup {
  isPhrase: boolean;
  text: string;
  sentence: string;
  loading: boolean;
  wordTranslation?: string;
  sentenceTranslation?: string | null;
  error?: string;
  paywall?: boolean;
  vocabId?: string;
  level?: number;
  seenCount?: number;
  saved?: boolean;
}

// M3 Slice 3: shared content for both the desktop side panel and the mobile
// bottom sheet — same interaction scenario, different container chrome
// (docs/ui/m3-slice3-library-reader-plan.md). The three old "💬/📖/✏️" buttons
// were dead paywall stubs with no backing feature (confirmed in the artifact
// audit: no LLM provider exists anywhere in the repo) — replaced with one
// honest, explicit "not available yet" line instead of pretending it works.
export default function ReaderWordPanel({
  popup,
  manualTranslation,
  onManualTranslationChange,
  onManualTranslationSubmit,
  onSpeak,
  onSetLevel,
  onAddPhrase,
  onClose,
}: {
  popup: Popup;
  manualTranslation: string;
  onManualTranslationChange: (value: string) => void;
  onManualTranslationSubmit: () => void;
  onSpeak: (text: string) => void;
  onSetLevel: (level: 0 | 1 | 2 | 3 | 4) => void;
  onAddPhrase: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-lg font-bold">{popup.text}</p>
            <button
              type="button"
              onClick={() => onSpeak(popup.text)}
              aria-label="Прослушать произношение"
              className="focus-ring flex min-h-11 min-w-11 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--color-forest-text)]"
            >
              🔊
            </button>
            {popup.isPhrase && (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs">фраза</span>
            )}
          </div>

          {popup.loading ? (
            <p className="text-[var(--text-secondary)]">Переводим…</p>
          ) : popup.paywall ? (
            <p className="text-[var(--text-secondary)]">
              {popup.isPhrase
                ? "Бесплатный лимит карточек в Мозге исчерпан."
                : "Бесплатный лимит слов на сегодня исчерпан."}{" "}
              <Link
                href={`/pricing?reason=${popup.isPhrase ? "cards" : "words"}`}
                className="focus-ring font-semibold text-[var(--color-caramel-text)] underline"
              >
                Смотреть Premium
              </Link>
            </p>
          ) : popup.error ? (
            <div className="mt-1 rounded-lg bg-[var(--danger-tint,transparent)] p-3">
              <p className="text-sm text-[var(--color-danger)]" role="alert">
                {popup.error}
              </p>
              <div className="mt-2 flex gap-2">
                <label htmlFor="manual-translation-input" className="sr-only">
                  Перевод вручную
                </label>
                <input
                  id="manual-translation-input"
                  type="text"
                  value={manualTranslation}
                  onChange={(e) => onManualTranslationChange(e.target.value)}
                  placeholder="Впиши перевод вручную"
                  className="focus-ring min-w-0 flex-1 rounded border border-[var(--border-strong)] bg-[var(--surface)] px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={onManualTranslationSubmit}
                  disabled={!manualTranslation.trim()}
                  className="focus-ring flex min-h-11 shrink-0 items-center text-sm font-semibold text-[var(--color-forest-text)] disabled:opacity-40"
                >
                  + Добавить перевод
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-semibold text-[var(--color-forest-text)]">{popup.wordTranslation}</p>
              {popup.sentenceTranslation && (
                <p className="mt-1 text-sm italic text-[var(--text-secondary)]">{popup.sentenceTranslation}</p>
              )}
              {!popup.isPhrase && popup.level !== undefined && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {WORD_LEVELS[popup.level].label} · Видел {popup.seenCount}×
                </p>
              )}
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                💬 Подробное объяснение в контексте пока недоступно — нет AI-провайдера для этого. Показан
                только словарный перевод и исходное предложение.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="focus-ring flex min-h-11 min-w-11 shrink-0 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--color-forest-text)]"
        >
          ✕
        </button>
      </div>

      {!popup.isPhrase && popup.vocabId && (
        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">Уровень знания</p>
          <div className="grid grid-cols-5 gap-1.5">
            {WORD_LEVELS.map((l) => (
              <button
                key={l.level}
                type="button"
                onClick={() => onSetLevel(l.level as 0 | 1 | 2 | 3 | 4)}
                style={{ backgroundColor: popup.level === l.level ? l.color : `${l.color}33` }}
                className="focus-ring flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold"
              >
                {l.level}
              </button>
            ))}
          </div>
        </div>
      )}

      {!popup.loading && !popup.error && !popup.paywall && (
        <div className="flex gap-2">
          {popup.isPhrase ? (
            <button
              type="button"
              onClick={onAddPhrase}
              disabled={popup.saved}
              className="focus-ring flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[var(--color-forest)] px-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {popup.saved ? "Сохранено ✓" : "Сохранить фразу"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSetLevel(4)}
              className={`focus-ring flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold ${
                popup.level === 4 ? "text-black" : "text-white"
              }`}
              style={{ backgroundColor: popup.level === 4 ? WORD_LEVELS[4].color : "var(--color-forest)" }}
            >
              {popup.level === 4 ? "Сохранено ✓" : "Уже знаю"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
