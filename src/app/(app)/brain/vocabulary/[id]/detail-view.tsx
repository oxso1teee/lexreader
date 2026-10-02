"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Type, MessageSquare, Volume2, type LucideIcon } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { bulkMoveToDeck, bulkMarkKnown, bulkDeleteFlashcards } from "../actions";
import { updateFlashcard, type UpdateCardState } from "../../[deckId]/actions";
import { LEARNING_STATE_LABEL } from "@/lib/vocabulary/learning-state-label";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { VocabularyDetail } from "./page";

const ITEM_TYPE_LABEL: Record<"word" | "phrase", { icon: LucideIcon; label: string }> = {
  word: { icon: Type, label: "Слово" },
  phrase: { icon: MessageSquare, label: "Фраза" },
};
const SOURCE_LABEL = {
  reader: "Из чтения",
  manual: "Добавлено вручную",
  import_bulk: "Импортировано",
  starter_deck: "Стартовый набор",
  mission: "Из задания",
  path: "Из курса",
  extension: "Из расширения",
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
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
            {(() => {
              const { icon: Icon, label } = ITEM_TYPE_LABEL[detail.itemType];
              return (
                <>
                  <Icon aria-hidden="true" className="h-3 w-3" />
                  {label}
                </>
              );
            })()}
          </span>
          <span className="rounded-full bg-forest/15 px-2 py-0.5 text-xs font-medium text-[var(--color-forest-text)]">
            {LEARNING_STATE_LABEL[detail.learningState]}
          </span>
          <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
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
              className="rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-forest)]"
            />
            <input
              name="back"
              defaultValue={detail.back}
              required
              aria-label="Перевод"
              className="rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-forest)]"
            />
            <input
              name="notes"
              defaultValue={detail.notes ?? ""}
              placeholder="Заметка (необязательно)"
              className="rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--color-forest)]"
            />
            {editState.error && (
              <p className="text-sm text-[var(--color-danger-text)]" role="alert">
                {editState.error}
              </p>
            )}
            <div className="mt-1 flex gap-2">
              <Button variant="ghost" onClick={() => setIsEditing(false)} className="flex-1">
                Отмена
              </Button>
              <Button type="submit" variant="leaf" disabled={editPending} className="flex-1">
                {editPending ? "…" : "Сохранить"}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-2xl font-bold">{detail.front}</h2>
              <button type="button" onClick={speak} aria-label="Произнести" className="focus-ring flex min-h-11 min-w-11 items-center justify-center">
                <Volume2 aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-3 text-lg text-[var(--text-secondary)]">{detail.back}</p>
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
              <ButtonLink href={`/brain/${detail.deckId}/review?wordIds=${detail.flashcardId}`} variant="leaf">
                Практика сейчас
              </ButtonLink>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setIsEditing(true)} className="flex-1">
                  Редактировать
                </Button>
                {detail.vocabularyItemId && detail.knowledgeStatus !== "known" && (
                  <Button variant="ghost" disabled={isPending} onClick={handleMarkKnown} className="flex-1">
                    Уже знаю
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  aria-label="Переместить в колоду"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                  className="focus-ring min-h-11 flex-1 rounded-full border border-[var(--border-strong)] bg-transparent px-3 text-sm outline-none focus:border-[var(--color-forest)]"
                >
                  <option value="">Переместить в колоду…</option>
                  {decks.filter((d) => d.id !== detail.deckId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {moveTarget && (
                  <Button variant="ghost" disabled={isPending} onClick={handleMove}>
                    OK
                  </Button>
                )}
              </div>
              {/* ghost + красный текст, а не variant="danger" — как «Сбросить» в
                  Language Twin (фаза 11e-3): кнопка только открывает confirm(),
                  финальное подтверждение — сам диалог. */}
              <Button variant="ghost" disabled={isPending} onClick={handleDelete} className="text-[var(--color-danger-text)]">
                Удалить карточку
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 font-semibold">Контексты ({detail.contexts.length})</h3>
        {detail.contexts.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            Пока нет сохранённых примеров использования — они появляются, когда ты встречаешь это{" "}
            {detail.itemType === "phrase" ? "выражение" : "слово"} во время чтения.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.contexts.map((ctx) => (
              <li key={ctx.id} className="rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm">
                <p>{ctx.contextText}</p>
                {ctx.contextTranslation && <p className="mt-0.5 text-[var(--text-secondary)]">{ctx.contextTranslation}</p>}
                <div className="mt-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  {ctx.sourceTextId && ctx.sourceTextTitle ? (
                    <Link href={`/read/${ctx.sourceTextId}`} className="font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline">
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
      </Card>
    </div>
  );
}
