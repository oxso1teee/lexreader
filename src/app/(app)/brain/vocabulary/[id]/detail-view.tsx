"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { track } from "@/lib/posthog-client";
import { bulkMoveToDeck, bulkMarkKnown, bulkDeleteFlashcards } from "../actions";
import { updateFlashcard, type UpdateCardState } from "../../[deckId]/actions";
import type { VocabularyDetail } from "./page";

const ITEM_TYPE_LABEL = { word: "🔤 Слово", phrase: "💬 Фраза" } as const;
const LEARNING_STATE_LABEL = {
  new: "Новое",
  learning: "Учу",
  familiar: "Знакомое",
  active: "Активное",
  maintenance: "Поддерживается",
} as const;
const SOURCE_LABEL = {
  reader: "Из чтения",
  manual: "Добавлено вручную",
  import_bulk: "Импортировано",
  starter_deck: "Стартовый набор",
  mission: "Из задания",
  path: "Из курса",
} as const;
const BUCKET_LABEL = { new: "Новое", due: "К повторению", learning: "Учу", known: "Знаю" } as const;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export default function VocabularyItemDetail({
  detail,
  decks,
}: {
  detail: VocabularyDetail;
  decks: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [moveTarget, setMoveTarget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const editSubmittedRef = useRef(false);

  useEffect(() => {
    track("vocabulary_item_opened", { item_type: detail.itemType, learning_state: detail.learningState, source_type: detail.sourceType });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editAction = updateFlashcard.bind(null, detail.deckId, detail.flashcardId);
  const [editState, editFormAction, editPending] = useActionState<UpdateCardState, FormData>(editAction, {});

  useEffect(() => {
    if (editSubmittedRef.current && !editPending && !editState.error) {
      editSubmittedRef.current = false;
      setIsEditing(false);
      router.refresh();
    }
  }, [editPending, editState, router]);

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(detail.front);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function handleMove() {
    if (!moveTarget) return;
    startTransition(async () => {
      const result = await bulkMoveToDeck([detail.flashcardId], moveTarget);
      setMessage(result.ok ? "Перемещено" : (result.error ?? "Ошибка"));
      if (result.ok) router.refresh();
    });
  }

  function handleMarkKnown() {
    if (!detail.vocabularyItemId) return;
    startTransition(async () => {
      const result = await bulkMarkKnown([detail.vocabularyItemId!]);
      setMessage(result.ok ? "Отмечено" : (result.error ?? "Ошибка"));
      if (result.ok) router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`Удалить «${detail.front}»? История повторений будет удалена безвозвратно.`)) return;
    startTransition(async () => {
      const result = await bulkDeleteFlashcards([detail.flashcardId]);
      if (result.ok) {
        track("vocabulary_bulk_action_used", { action: "delete" });
        router.push("/brain/vocabulary");
      } else {
        setMessage(result.error ?? "Ошибка");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
            {ITEM_TYPE_LABEL[detail.itemType]}
          </span>
          <span className="rounded-full bg-caramel/15 px-2 py-0.5 text-xs font-medium text-[var(--color-caramel-text)]">
            {LEARNING_STATE_LABEL[detail.learningState]}
          </span>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
            {SOURCE_LABEL[detail.sourceType]}
          </span>
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
              defaultValue={detail.front}
              required
              aria-label={detail.itemType === "phrase" ? "Фраза" : "Слово"}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
            <input
              name="back"
              defaultValue={detail.back}
              required
              aria-label="Перевод"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
            <input
              name="notes"
              defaultValue={detail.notes ?? ""}
              placeholder="Заметка (необязательно)"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20"
            />
            {editState.error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {editState.error}
              </p>
            )}
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => setIsEditing(false)} className="focus-ring min-h-11 flex-1 rounded-full bg-black/10 text-sm font-medium dark:bg-white/10">
                Отмена
              </button>
              <button type="submit" disabled={editPending} className="focus-ring min-h-11 flex-1 rounded-full bg-caramel text-sm font-medium text-black disabled:opacity-50">
                {editPending ? "…" : "Сохранить"}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-2xl font-bold">{detail.front}</h2>
              <button type="button" onClick={speak} aria-label="Произнести" className="focus-ring flex min-h-11 min-w-11 items-center justify-center">
                🔊
              </button>
            </div>
            <p className="mb-3 text-lg text-black/70 dark:text-white/70">{detail.back}</p>
            {detail.notes && <p className="mb-3 text-sm text-[var(--text-secondary)]">{detail.notes}</p>}

            <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <dt className="text-[var(--text-secondary)]">Колода</dt>
              <dd className="text-right">{detail.deckName}</dd>
              <dt className="text-[var(--text-secondary)]">Статус повторения</dt>
              <dd className="text-right">{BUCKET_LABEL[detail.schedulerBucket]}</dd>
              {detail.knowledgeStatus && (
                <>
                  <dt className="text-[var(--text-secondary)]">Знание слова</dt>
                  <dd className="text-right">{detail.knowledgeStatus === "known" ? "Знаю" : detail.knowledgeStatus === "learning" ? "Учу" : "Новое"}</dd>
                </>
              )}
              {detail.schedulerBucket !== "new" && (
                <>
                  <dt className="text-[var(--text-secondary)]">Следующее повторение</dt>
                  <dd className="text-right">{formatDate(detail.dueAt)}</dd>
                </>
              )}
              {detail.totalReviews > 0 && (
                <>
                  <dt className="text-[var(--text-secondary)]">Повторений / точность</dt>
                  <dd className="text-right">
                    {detail.totalReviews} · {Math.round((detail.accuracy ?? 0) * 100)}%
                  </dd>
                </>
              )}
              <dt className="text-[var(--text-secondary)]">Добавлено</dt>
              <dd className="text-right">{formatDate(detail.createdAt)}</dd>
            </dl>

            {message && <p className="mb-2 text-xs text-[var(--text-secondary)]">{message}</p>}

            <div className="flex flex-col gap-2">
              <Link
                href={`/brain/${detail.deckId}/review?wordIds=${detail.flashcardId}`}
                className="focus-ring flex min-h-11 items-center justify-center rounded-full bg-caramel text-sm font-medium text-black"
              >
                Практика сейчас
              </Link>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsEditing(true)} className="focus-ring min-h-11 flex-1 rounded-full border border-black/10 text-sm font-medium dark:border-white/15">
                  Редактировать
                </button>
                {detail.vocabularyItemId && detail.knowledgeStatus !== "known" && (
                  <button type="button" disabled={isPending} onClick={handleMarkKnown} className="focus-ring min-h-11 flex-1 rounded-full border border-black/10 text-sm font-medium dark:border-white/15">
                    Уже знаю
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  aria-label="Переместить в колоду"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="focus-ring min-h-11 flex-1 rounded-full border border-black/15 px-3 text-sm dark:border-white/20"
                >
                  <option value="">Переместить в колоду…</option>
                  {decks.filter((d) => d.id !== detail.deckId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {moveTarget && (
                  <button type="button" disabled={isPending} onClick={handleMove} className="focus-ring min-h-11 rounded-full bg-black/10 px-3 text-sm font-medium dark:bg-white/10">
                    OK
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={handleDelete}
                className="focus-ring min-h-11 rounded-full border border-red-200 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
              >
                Удалить карточку
              </button>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-semibold">Контексты ({detail.contexts.length})</h3>
        {detail.contexts.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Пока нет сохранённых примеров использования — они появляются, когда ты встречаешь это{" "}
            {detail.itemType === "phrase" ? "выражение" : "слово"} во время чтения.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.contexts.map((ctx) => (
              <li key={ctx.id} className="rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                <p className="text-black/70 dark:text-white/70">{ctx.contextText}</p>
                {ctx.contextTranslation && <p className="mt-0.5 text-[var(--text-secondary)]">{ctx.contextTranslation}</p>}
                <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  {ctx.sourceTextId && ctx.sourceTextTitle ? (
                    <Link href={`/read/${ctx.sourceTextId}`} className="font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline">
                      из «{ctx.sourceTextTitle}»
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span>{formatDate(ctx.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
