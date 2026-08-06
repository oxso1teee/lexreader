"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { VocabularyRow } from "@/lib/vocabulary-list";
import { bulkMoveToDeck, bulkMarkKnown, bulkDeleteFlashcards } from "./actions";
import { updateFlashcard, type UpdateCardState } from "../[deckId]/actions";

const BUCKET_LABELS: Record<VocabularyRow["schedulerBucket"], string> = {
  new: "Новое",
  due: "К повторению",
  learning: "Учу",
  known: "Знаю",
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

// M3 Slice 4 §10: показываем только производные, читаемые пользователем
// значения (bucket-label, дата, точность в процентах) — ни здесь, ни нигде
// в этом компоненте не рендерится сырой FSRS Card JSON.
export default function ItemDetailsSheet({
  item,
  decks,
  onClose,
}: {
  item: VocabularyRow;
  decks: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [moveTarget, setMoveTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const editSubmittedRef = useRef(false);

  const editAction = updateFlashcard.bind(null, item.deckId, item.flashcardId);
  const [editState, editFormAction, editPending] = useActionState<UpdateCardState, FormData>(editAction, {});

  useEffect(() => {
    if (editSubmittedRef.current && !editPending && !editState.error) {
      editSubmittedRef.current = false;
      setIsEditing(false);
    }
  }, [editPending, editState]);

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(item.front);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function handleMove() {
    if (!moveTarget) return;
    startTransition(async () => {
      const result = await bulkMoveToDeck([item.flashcardId], moveTarget);
      setMessage(result.ok ? "Перемещено" : (result.error ?? "Ошибка"));
      if (result.ok) onClose();
    });
  }

  function handleMarkKnown() {
    if (!item.vocabularyItemId) return;
    startTransition(async () => {
      const result = await bulkMarkKnown([item.vocabularyItemId!]);
      setMessage(result.ok ? "Отмечено" : (result.error ?? "Ошибка"));
      if (result.ok) onClose();
    });
  }

  function handleDelete() {
    if (!confirm(`Удалить «${item.front}»? История повторений будет удалена безвозвратно.`)) return;
    startTransition(async () => {
      const result = await bulkDeleteFlashcards([item.flashcardId]);
      if (result.ok) onClose();
      else setMessage(result.error ?? "Ошибка");
    });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:px-6">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl">
        <div className="mb-3 flex items-center justify-between">
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
            {item.isPhrase ? "💬 Фраза" : "🔤 Слово"}
          </span>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex min-h-9 min-w-9 items-center justify-center">
            ✕
          </button>
        </div>

        {isEditing ? (
          <form
            action={(fd) => {
              editSubmittedRef.current = true;
              editFormAction(fd);
            }}
            className="flex flex-col gap-2"
          >
            <input
              name="front"
              defaultValue={item.front}
              required
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
            <input
              name="back"
              defaultValue={item.back}
              required
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
            <input
              name="notes"
              defaultValue={item.notes ?? ""}
              placeholder="Заметка (необязательно)"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
            {editState.error && <p className="text-sm text-red-600 dark:text-red-400">{editState.error}</p>}
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => setIsEditing(false)} className="flex-1 rounded-full bg-black/10 py-2 text-sm font-medium dark:bg-white/10">
                Отмена
              </button>
              <button type="submit" disabled={editPending} className="flex-1 rounded-full bg-caramel py-2 text-sm font-medium text-black disabled:opacity-50">
                {editPending ? "…" : "Сохранить"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-xl font-bold">{item.front}</h2>
              <button type="button" onClick={speak} aria-label="Произнести" className="flex min-h-9 min-w-9 items-center justify-center">
                🔊
              </button>
            </div>
            <p className="mb-3 text-lg text-black/70 dark:text-white/70">{item.back}</p>

            {item.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photoUrl} alt="" className="mb-3 max-h-48 w-full rounded-lg object-cover" />
            )}

            {item.contextSentence && (
              <div className="mb-3 rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                <p className="text-black/70 dark:text-white/70">{item.contextSentence}</p>
                {item.contextTranslation && <p className="mt-0.5 text-[var(--text-secondary)]">{item.contextTranslation}</p>}
              </div>
            )}

            {item.sourceTextId && item.sourceTextTitle && (
              <Link href={`/read/${item.sourceTextId}`} className="mb-3 block text-sm font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline">
                из «{item.sourceTextTitle}»
              </Link>
            )}

            <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-[var(--text-secondary)]">Колода</dt>
              <dd className="text-right">{item.deckName}</dd>
              <dt className="text-[var(--text-secondary)]">Статус повторения</dt>
              <dd className="text-right">{BUCKET_LABELS[item.schedulerBucket]}</dd>
              {item.knowledgeStatus && (
                <>
                  <dt className="text-[var(--text-secondary)]">Знание слова</dt>
                  <dd className="text-right">{item.knowledgeStatus === "known" ? "Знаю" : item.knowledgeStatus === "learning" ? "Учу" : "Новое"}</dd>
                </>
              )}
              {item.schedulerBucket !== "new" && (
                <>
                  <dt className="text-[var(--text-secondary)]">Следующее повторение</dt>
                  <dd className="text-right">{formatDate(item.dueAt)}</dd>
                </>
              )}
              {item.totalReviews > 0 && (
                <>
                  <dt className="text-[var(--text-secondary)]">Повторений / точность</dt>
                  <dd className="text-right">
                    {item.totalReviews} · {Math.round((item.accuracy ?? 0) * 100)}%
                  </dd>
                </>
              )}
              <dt className="text-[var(--text-secondary)]">Добавлено</dt>
              <dd className="text-right">{formatDate(item.createdAt)}</dd>
            </dl>

            {message && <p className="mb-2 text-xs text-[var(--text-secondary)]">{message}</p>}

            <div className="flex flex-col gap-2">
              <Link
                href={`/brain/${item.deckId}/review`}
                className="flex min-h-11 items-center justify-center rounded-full bg-caramel text-sm font-medium text-black"
              >
                Повторить сейчас
              </Link>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsEditing(true)} className="flex-1 rounded-full border border-black/10 py-2 text-sm font-medium dark:border-white/15">
                  Редактировать
                </button>
                {item.vocabularyItemId && item.knowledgeStatus !== "known" && (
                  <button type="button" disabled={isPending} onClick={handleMarkKnown} className="flex-1 rounded-full border border-black/10 py-2 text-sm font-medium dark:border-white/15">
                    Уже знаю
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  aria-label="Переместить в колоду"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="flex-1 rounded-full border border-black/15 px-3 py-2 text-sm dark:border-white/20"
                >
                  <option value="">Переместить в колоду…</option>
                  {decks.filter((d) => d.id !== item.deckId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {moveTarget && (
                  <button type="button" disabled={isPending} onClick={handleMove} className="rounded-full bg-black/10 px-3 py-2 text-sm font-medium dark:bg-white/10">
                    OK
                  </button>
                )}
              </div>
              <button type="button" disabled={isPending} onClick={handleDelete} className="rounded-full border border-red-200 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400">
                Удалить карточку
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
