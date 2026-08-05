"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewWord, sendCardToNotebook, updateReviewBest } from "./actions";
import { updateFlashcard, type UpdateCardState } from "../actions";
import { reviewSrsState, type SrsParams } from "@/lib/srs";
import { reviewFsrsCard, type FsrsStateRow } from "@/lib/fsrs";
import { track } from "@/lib/posthog-client";
import SessionComplete from "./session-complete";

export interface ReviewCard {
  flashcardId: string;
  deckId: string;
  front: string;
  back: string;
  notes: string | null;
  contextSentence: string | null;
  contextTranslation: string | null;
  photoUrl: string | null;
  sourceTextId: string | null;
  sourceTextTitle: string | null;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  fsrsState: FsrsStateRow;
}

const GRADES: { value: 0 | 1 | 2 | 3; label: string; className: string }[] = [
  { value: 0, label: "Не помню", className: "bg-red-600 hover:bg-red-500" },
  { value: 1, label: "Трудно", className: "bg-orange-500 hover:bg-orange-400" },
  { value: 2, label: "Помню", className: "bg-emerald-600 hover:bg-emerald-500" },
  { value: 3, label: "Легко", className: "bg-emerald-700 hover:bg-emerald-600" },
];

// Из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.6): показываем
// итоговый интервал прямо на кнопках оценки — прозрачность алгоритма вместо
// "магии". Наша SRS не считает интервалы короче суток (см. lib/srs.ts), так
// что форматируем только дни/месяцы/годы.
function formatInterval(days: number): string {
  if (days >= 365) return `${Math.round(days / 365)} г`;
  if (days >= 30) return `${Math.round(days / 30)} мес`;
  return `${days} дн`;
}

export default function ReviewSession({
  cards: cardsProp,
  studyDirection,
  srsParams,
  bestSessionCount,
  fsrsEnabled,
  maxIntervalDays,
  targetLanguage,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  srsParams: SrsParams;
  bestSessionCount: number;
  fsrsEnabled: boolean;
  maxIntervalDays: number;
  targetLanguage: string;
}) {
  const router = useRouter();
  // Снимок очереди на момент старта сессии: серверные экшены ревью вызывают
  // неявный refresh страницы, из-за которого /review перезапросил бы уже
  // пустую очередь и подменил дерево прямо посреди сессии, если бы мы читали
  // проп напрямую.
  const [cards, setCards] = useState(cardsProp);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [tally, setTally] = useState<Record<0 | 1 | 2 | 3, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [notebookStatus, setNotebookStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [newRecord, setNewRecord] = useState(false);

  const done = index >= cards.length;
  const card = cards[index];
  const sessionTotal = tally[0] + tally[1] + tally[2] + tally[3];

  const editAction = card ? updateFlashcard.bind(null, card.deckId, card.flashcardId) : undefined;
  const [editState, editFormAction, editPending] = useActionState<UpdateCardState, FormData>(
    editAction ?? (async (state) => state),
    {},
  );
  const editSubmittedRef = useRef(false);

  useEffect(() => {
    if (editSubmittedRef.current && !editPending && !editState.error) {
      editSubmittedRef.current = false;
      setIsEditing(false);
    }
  }, [editPending, editState]);

  // P0-АУДИТ 3.12 (испр.): раньше здесь было жёстко "вопрос = back, ответ =
  // front" независимо от направления — с настройкой по умолчанию
  // ("Слово → Перевод") это показывало перевод и спрашивало слово, то есть
  // ровно наоборот тому, что написано в настройках.
  const question = studyDirection === "back_front" ? card?.back : card?.front;
  const answer = studyDirection === "back_front" ? card?.front : card?.back;

  // M3 Slice 4 §6: browser Web Speech API only, same pattern as the Reader's
  // Listening mode (src/app/read/[textId]/reader.tsx) — no paid TTS. `front`
  // is always the target-language word regardless of studyDirection, so
  // pronunciation always speaks it, not whichever side is "question" right now.
  const speechAvailable = typeof window !== "undefined" && "speechSynthesis" in window;
  function speak() {
    if (!speechAvailable || !card) return;
    const utterance = new SpeechSynthesisUtterance(card.front);
    utterance.lang = targetLanguage;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function exitSession() {
    if (sessionTotal > 0 && !confirm("Выйти из сессии? Прогресс по уже отвеченным карточкам сохранён.")) {
      return;
    }
    router.push("/brain");
  }

  // M3 Slice 4 §6: Space=reveal, 1-4=grade (Again/Hard/Good/Easy — same
  // order as the grade buttons below), Escape=exit. Never fires while an
  // input/textarea/contenteditable has focus (the edit-card form above).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = document.activeElement;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (isTyping || done) return;

      if (e.key === "Escape") {
        e.preventDefault();
        exitSession();
        return;
      }
      if (e.key === " " && !revealed) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && ["1", "2", "3", "4"].includes(e.key) && !isPending) {
        e.preventDefault();
        grade((Number(e.key) - 1) as 0 | 1 | 2 | 3);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, done, isPending, sessionTotal]);

  function grade(value: 0 | 1 | 2 | 3) {
    // Раздел 5 промта 2026-07-30 (полировка): короткий вибро-отклик на
    // оценке — можно выключить в Настройках (флаг только на устройстве,
    // не в аккаунте, поэтому localStorage, а не БД).
    if (typeof navigator !== "undefined" && navigator.vibrate && localStorage.getItem("lexreader_haptics_enabled") !== "false") {
      navigator.vibrate(15);
    }
    startTransition(async () => {
      await reviewWord(card.flashcardId, value);
      const newTotal = sessionTotal + 1;
      setTally((t) => ({ ...t, [value]: t[value] + 1 }));
      setFlash(value >= 2 ? "good" : "bad");
      setTimeout(() => setFlash(null), 500);
      setRevealed(false);
      setNotebookStatus("idle");
      setIsEditing(false);
      const isLastCard = index + 1 >= cards.length;
      if (isLastCard) {
        track("review_completed", { count: newTotal });
        if (newTotal > bestSessionCount) {
          setNewRecord(true);
          await updateReviewBest(newTotal);
        }
      }
      setIndex((i) => i + 1);
    });
  }

  function handleEditSubmit(formData: FormData) {
    editSubmittedRef.current = true;
    const front = String(formData.get("front") ?? "").trim();
    const back = String(formData.get("back") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    // Обновляем локальный снимок сессии сразу — иначе следующая карточка
    // (та же самая, index не двигался) продолжила бы показывать старый текст
    // до следующего полного релоада страницы.
    setCards((prev) =>
      prev.map((c, i) => (i === index ? { ...c, front, back, notes: notes || null } : c)),
    );
    editFormAction(formData);
  }

  async function handleSendToNotebook() {
    setNotebookStatus("saving");
    const result = await sendCardToNotebook(card.front, card.back);
    setNotebookStatus(result.ok ? "done" : "error");
  }

  if (done) {
    return <SessionComplete count={cards.length} newRecord={newRecord} />;
  }

  return (
    <div
      className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8"
      style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
    >
      {flash && (
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
            flash === "good" ? "bg-emerald-500/15" : "bg-red-500/15"
          }`}
        />
      )}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-black/50 dark:text-white/50">
          {index + 1} / {cards.length}
          {cards.length - index - 1 > 0 && <span> · осталось {cards.length - index - 1}</span>}
        </p>
        <button
          type="button"
          onClick={exitSession}
          aria-label="Завершить сессию"
          title="Выйти (Esc)"
          className="flex min-h-9 min-w-9 items-center justify-center rounded-full text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
        >
          ✕
        </button>
      </div>

      {isEditing ? (
        <form
          action={handleEditSubmit}
          className="flex flex-1 flex-col justify-center gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15"
        >
          <input
            name="front"
            defaultValue={card.front}
            required
            placeholder="Слово"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
          />
          <input
            name="back"
            defaultValue={card.back}
            required
            placeholder="Перевод"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
          />
          <input
            name="notes"
            defaultValue={card.notes ?? ""}
            placeholder="Заметка (необязательно)"
            className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
          />
          {editState.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{editState.error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-black/10 text-sm dark:border-white/15"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={editPending}
              className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-caramel text-sm font-medium text-white disabled:opacity-50"
            >
              {editPending ? "…" : "Сохранить"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
            <div className="flex items-center gap-2">
              <p className="text-2xl font-semibold">{question}</p>
              {speechAvailable && (
                <button
                  type="button"
                  onClick={speak}
                  aria-label="Произнести"
                  className="flex min-h-9 min-w-9 items-center justify-center text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                >
                  🔊
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label="Редактировать карточку"
                className="flex min-h-9 min-w-9 items-center justify-center text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
              >
                ✎
              </button>
            </div>

            {revealed && (
              <div className="flip-reveal flex flex-col items-center gap-2">
                {card.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.photoUrl}
                    alt=""
                    className="max-h-40 rounded-lg object-cover"
                  />
                )}
                <p className="text-xl font-medium text-black/80 dark:text-white/80">{answer}</p>
                {card.notes && (
                  <p className="max-w-sm text-sm text-black/50 dark:text-white/50">{card.notes}</p>
                )}
                {card.contextSentence && (
                  <div className="max-w-sm rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
                    <p className="text-black/70 dark:text-white/70">{card.contextSentence}</p>
                    {card.contextTranslation && (
                      <p className="mt-0.5 text-black/50 dark:text-white/50">{card.contextTranslation}</p>
                    )}
                  </div>
                )}
                {card.sourceTextId && card.sourceTextTitle && (
                  <a
                    href={`/read/${card.sourceTextId}`}
                    className="text-xs font-medium text-caramel underline-offset-2 hover:underline"
                  >
                    из «{card.sourceTextTitle}»
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleSendToNotebook}
                  disabled={notebookStatus === "saving" || notebookStatus === "done"}
                  className="mt-1 text-xs font-medium text-black/40 underline-offset-2 hover:text-black hover:underline disabled:no-underline disabled:opacity-60 dark:text-white/40 dark:hover:text-white"
                >
                  {notebookStatus === "done"
                    ? "✓ Сохранено в слова из чтения"
                    : notebookStatus === "saving"
                      ? "Добавляем…"
                      : notebookStatus === "error"
                        ? "Не удалось — попробовать снова?"
                        : "📥 Сохранить в слова из чтения"}
                </button>
              </div>
            )}
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
            >
              Показать ответ
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {bestSessionCount > 0 && (
                <div>
                  <p className="text-center text-xs text-black/40 dark:text-white/40">
                    Сегодня {sessionTotal} · рекорд {Math.max(bestSessionCount, sessionTotal)}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-caramel transition-[width]"
                      style={{
                        width: `${Math.min(100, (sessionTotal / Math.max(bestSessionCount, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {GRADES.map((g) => {
                // M2 Learning Upgrade (LEARN-007): один и тот же адаптер для
                // предпросмотра и для реального сохранения (src/lib/fsrs.ts,
                // reviewFsrsCard) — не отдельная копия формулы. Ветка по
                // fsrsEnabled только выбирает, чьё число показать; сам расчёт
                // не дублируется ни для одного из двух алгоритмов.
                const previewDays = fsrsEnabled
                  ? reviewFsrsCard(card.fsrsState, g.value, maxIntervalDays).fsrsScheduledDays
                  : reviewSrsState(
                      { easeFactor: card.easeFactor, intervalDays: card.intervalDays, repetitions: card.repetitions },
                      g.value,
                      srsParams,
                    ).intervalDays;
                return (
                  <button
                    key={g.value}
                    type="button"
                    disabled={isPending}
                    onClick={() => grade(g.value)}
                    className={`flex min-h-11 flex-col items-center justify-center rounded-full px-4 py-3 font-medium text-white transition-colors disabled:opacity-50 ${g.className}`}
                  >
                    <span>{g.label}</span>
                    <span className="text-xs font-normal opacity-80">
                      {formatInterval(previewDays)}
                    </span>
                  </button>
                );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Из разбора конкурента (п. "Живой счётчик ответов"): промежуточный
          итог ТЕКУЩЕЙ сессии, не за всё время. */}
      <div className="mt-4 flex justify-center gap-3 text-xs text-black/40 dark:text-white/40">
        <span>❌ {tally[0]}</span>
        <span>🟠 {tally[1]}</span>
        <span>✅ {tally[2]}</span>
        <span>⭐ {tally[3]}</span>
      </div>

      {/* M3 Slice 4 §6: клавиатурные подсказки — desktop only, мобильным
          пользователям это неактуально (нет физической клавиатуры). */}
      <p className="mt-2 hidden justify-center gap-2 text-center text-[11px] text-black/30 sm:flex dark:text-white/30">
        <span>Пробел — ответ</span>
        <span>·</span>
        <span>1–4 — оценка</span>
        <span>·</span>
        <span>Esc — выход</span>
      </p>
    </div>
  );
}
