"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { reviewWord, undoLastGrade, sendCardToNotebook, updateReviewBest, getCurrentStreak } from "./actions";
import { updateFlashcard, type UpdateCardState } from "../actions";
import { reviewSrsState, type SrsParams } from "@/lib/srs";
import { reviewFsrsCard, type FsrsStateRow } from "@/lib/fsrs";
import { track } from "@/lib/posthog-client";
import { loadReviewSession, saveReviewSession, clearReviewSession } from "@/lib/review-session-resume";
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

// M3 Slice 4.1: bg-orange-500/emerald-600 gave white text only 2.88:1/3.65:1
// (found via axe-core, e2e/practice-brain-a11y.spec.ts) — one shade darker
// each clears WCAG AA 4.5:1 while keeping the same red→orange→green meaning
// and relative light→dark progression between "Помню"/"Легко". red-600
// already passed as-is.
//
// Review mockup alignment — reference asks for var(--color-danger)/forest
// tokens. Again: --color-danger resolves to #dc2626, the exact same hex as
// bg-red-600 already in use — switched to the token (zero visual change,
// clearer intent). Hard: --color-warning resolves to #ea580c (Tailwind
// orange-600) — hand-computed WCAG contrast for white-on-#ea580c is ~3.56:1,
// BELOW the 4.5:1 AA floor that was the whole point of the darkening above
// (and axe-core would very likely re-flag it), so kept the current
// bg-orange-700 (#c2410c, ~5.18:1, verified safe) instead of the token —
// same warm-orange hue family the reference asks for, just the shade that's
// actually accessible. Good/Easy: --color-forest (~9.6:1) and
// --color-forest-light (~6.28:1) both clear AA comfortably with white text.
const GRADES: { value: 0 | 1 | 2 | 3; label: string; className: string }[] = [
  { value: 0, label: "Не помню", className: "bg-[var(--color-danger)] hover:opacity-90" },
  { value: 1, label: "Трудно", className: "bg-orange-700 hover:opacity-90" },
  { value: 2, label: "Помню", className: "bg-[var(--color-forest)] hover:opacity-90" },
  { value: 3, label: "Легко", className: "bg-[var(--color-forest-light)] hover:opacity-90" },
];

// Review mockup alignment — useSyncExternalStore, тот же паттерн, что уже
// принят в src/lib/use-is-native.ts для точно такого же класса проблемы
// (браузерное API, недоступное на сервере): getServerSnapshot обязана
// вернуть то же самое, что первый клиентский рендер при гидратации, иначе
// React расходится в тексте/DOM между SSR и клиентом. Раньше здесь было
// `typeof window !== "undefined" && …` прямо в теле рендера — валидный на
// сервере false, но потенциально true уже на первом клиентском рендере,
// то есть настоящий hydration mismatch (не просто lint-придирка): React
// ловил это на кнопке 🔊 (которая то есть, то нет между SSR/CSR) и
// перерисовывал всё поддерево с нуля, что как побочный эффект стирало
// data-theme, поставленный до гидратации в theme-init-script.ts (React не
// знает про этот атрибут — он не из её виртуального DOM — и снимает его при
// реконсиляции того же узла). На практике это гасило тёмную тему именно на
// этом экране, что прямо противоречит "Тёмная тема обязательна" из этой же
// задачи — поэтому чиним, хоть это и вне явно перечисленных файлов/функций.
function subscribeNoop(): () => void {
  return () => {};
}
function getSpeechSnapshot(): boolean {
  return "speechSynthesis" in window;
}
function getSpeechServerSnapshot(): boolean {
  return false;
}

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
  userId,
  sessionDeckId,
  missionId = null,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  srsParams: SrsParams;
  bestSessionCount: number;
  fsrsEnabled: boolean;
  maxIntervalDays: number;
  targetLanguage: string;
  userId: string;
  sessionDeckId: string;
  missionId?: string | null;
}) {
  const router = useRouter();
  // Снимок очереди на момент старта сессии: серверные экшены ревью вызывают
  // неявный refresh страницы, из-за которого /review перезапросил бы уже
  // пустую очередь и подменил дерево прямо посреди сессии, если бы мы читали
  // проп напрямую.
  //
  // M3 Slice 4 §7: если есть валидная резюмируемая сессия (тот же
  // пользователь/deckId, не устаревшая) — переупорядочиваем cardsProp под её
  // cardIds. Уже оценённые карточки (gradedIds) исключаем явно, а не просто
  // полагаемся на то, что их due_at ушёл в будущее и сервер сам не вернёт их
  // в свежей выдаче: reviewSrsState() при grade=0 ставит intervalDays=1, но
  // это всё равно >0 дней вперёд, так что на практике совпадает — явный
  // фильтр по gradedIds делает это гарантией, а не побочным эффектом
  // планировщика. Индекс всегда 0 у отфильтрованного списка — это и есть
  // "следующая неоценённая карточка", а не позиция в исходном (более
  // длинном) списке до фильтрации.
  const [cards, setCards] = useState(() => {
    const session = loadReviewSession(userId, sessionDeckId);
    if (!session) return cardsProp;
    const byId = new Map(cardsProp.map((c) => [c.flashcardId, c]));
    const gradedSet = new Set(session.gradedIds);
    const restored = session.cardIds
      .filter((id) => !gradedSet.has(id))
      .map((id) => byId.get(id))
      .filter((c): c is ReviewCard => !!c);
    return restored.length > 0 ? restored : cardsProp;
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(() => {
    const session = loadReviewSession(userId, sessionDeckId);
    return session?.phase === "answer";
  });
  const gradedIdsRef = useRef<string[]>(loadReviewSession(userId, sessionDeckId)?.gradedIds ?? []);
  const [isPending, startTransition] = useTransition();
  // Резюмированные оценки не разбиты по типу (gradedIds не хранит grade) —
  // счётчик по типам честно стартует с 0 и накапливается только за остаток
  // сессии; "не повторно оценивать" гарантируется index/gradedIds, а не этим
  // косметическим счётчиком.
  const [tally, setTally] = useState<Record<0 | 1 | 2 | 3, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [notebookStatus, setNotebookStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const [newRecord, setNewRecord] = useState(false);
  // M3 Slice 4 §8: только последняя оценка отменяема — новый grade() ниже
  // затирает lastGraded, так что второй "Отменить" для той же карточки уже
  // не находит, что отменять (защита от повторной отмены на клиенте;
  // undoLastGrade() сама же перепроверяет это и на сервере).
  const [lastGraded, setLastGraded] = useState<{
    reviewLogId: string;
    flashcardId: string;
    front: string;
    grade: 0 | 1 | 2 | 3;
  } | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);
  // Один и тот же localStorage-чтение, что и у cards/revealed выше — цена
  // незначительна (одна строка), а по этому единственному месту решается,
  // какое из двух взаимоисключающих событий отправить при монтировании.
  const wasResumedRef = useRef(!!loadReviewSession(userId, sessionDeckId));
  // Review mockup alignment — top bar streak flame. Same real, already-used
  // server action session-complete.tsx already calls (getCurrentStreak() ->
  // profiles.streak_current); reusing it here needed zero new props threaded
  // through review-mode-switcher.tsx (out of scope for this task) since this
  // component is already "use client" and can call it directly.
  const [streak, setStreak] = useState<number | null>(null);
  useEffect(() => {
    getCurrentStreak().then(setStreak);
  }, []);

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

  // M3 Slice 4 §16: ровно одно из двух взаимоисключающих событий на
  // монтирование — card_count вместо содержимого карточек.
  useEffect(() => {
    track(wasResumedRef.current ? "review_session_resumed" : "review_session_started", {
      card_count: cardsProp.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // See subscribeNoop/getSpeechSnapshot/getSpeechServerSnapshot above for why
  // this is useSyncExternalStore and not a plain `typeof window` check.
  const speechAvailable = useSyncExternalStore(subscribeNoop, getSpeechSnapshot, getSpeechServerSnapshot);
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
        revealAnswer();
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

  // M3 Slice 4 §7: единственное место, где revealed становится true —
  // сохраняем phase='answer', чтобы резюм точно знал, что вопрос уже
  // раскрыт (иначе после reload пользователь снова увидел бы закрытую
  // карточку, которую уже открывал).
  function revealAnswer() {
    setRevealed(true);
    track("review_answer_revealed");
    saveReviewSession({
      userId,
      deckId: sessionDeckId,
      cardIds: cards.map((c) => c.flashcardId),
      gradedIds: gradedIdsRef.current,
      index,
      phase: "answer",
    });
  }

  function grade(value: 0 | 1 | 2 | 3) {
    // Раздел 5 промта 2026-07-30 (полировка): короткий вибро-отклик на
    // оценке — можно выключить в Настройках (флаг только на устройстве,
    // не в аккаунте, поэтому localStorage, а не БД).
    if (typeof navigator !== "undefined" && navigator.vibrate && localStorage.getItem("lexreader_haptics_enabled") !== "false") {
      navigator.vibrate(15);
    }
    startTransition(async () => {
      const { reviewLogId } = await reviewWord(card.flashcardId, value, "cards");
      track("review_card_graded", { grade: value });
      gradedIdsRef.current = [...gradedIdsRef.current, card.flashcardId];
      setLastGraded(
        reviewLogId ? { reviewLogId, flashcardId: card.flashcardId, front: card.front, grade: value } : null,
      );
      const newTotal = sessionTotal + 1;
      setTally((t) => ({ ...t, [value]: t[value] + 1 }));
      setFlash(value >= 2 ? "good" : "bad");
      setTimeout(() => setFlash(null), 500);
      setRevealed(false);
      setNotebookStatus("idle");
      setIsEditing(false);
      const isLastCard = index + 1 >= cards.length;
      if (isLastCard) {
        track("review_session_completed", { count: newTotal });
        clearReviewSession();
        if (newTotal > bestSessionCount) {
          setNewRecord(true);
          await updateReviewBest(newTotal);
        }
      } else {
        saveReviewSession({
          userId,
          deckId: sessionDeckId,
          cardIds: cards.map((c) => c.flashcardId),
          gradedIds: gradedIdsRef.current,
          index: index + 1,
          phase: "question",
        });
      }
      setIndex((i) => i + 1);
    });
  }

  // M3 Slice 4 §8: возвращает карточку в текущую сессию на то же место
  // (cards — фиксированный массив, index просто отступает назад — сама
  // карточка никуда не вставляется повторно). Ownership/staleness уже
  // проверены на сервере (undoLastGrade) — здесь только честно отражаем
  // результат в UI.
  async function undo() {
    if (!lastGraded || isUndoing) return;
    setIsUndoing(true);
    const result = await undoLastGrade(lastGraded.reviewLogId);
    setIsUndoing(false);
    if (!result.ok) {
      alert(result.error ?? "Не удалось отменить оценку.");
      return;
    }
    track("review_undo_used");
    gradedIdsRef.current = gradedIdsRef.current.filter((id) => id !== lastGraded.flashcardId);
    setTally((t) => ({ ...t, [lastGraded.grade]: Math.max(0, t[lastGraded.grade] - 1) }));
    setRevealed(false);
    setIndex((i) => {
      const restoredIndex = Math.max(0, i - 1);
      saveReviewSession({
        userId,
        deckId: sessionDeckId,
        cardIds: cards.map((c) => c.flashcardId),
        gradedIds: gradedIdsRef.current,
        index: restoredIndex,
        phase: "question",
      });
      return restoredIndex;
    });
    setLastGraded(null);
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
    // M3 Slice 4 §8 (found while writing e2e coverage): grading the very
    // last card sets `lastGraded` and flips `done` to true in the same
    // batch — without this, the Undo bar would never get a render to
    // appear in, and a mis-grade on the session's final card would be
    // permanently un-undoable. undo() already handles restoredIndex
    // correctly here (cards.length-1 < cards.length reopens this same
    // card as a fresh question).
    return (
      <>
        {lastGraded && (
          <div className="mx-auto flex w-full max-w-md justify-center px-5 pt-8">
            <button
              type="button"
              onClick={undo}
              disabled={isUndoing}
              className="flex min-h-9 items-center justify-center gap-1 rounded-full border border-black/10 px-3 text-xs font-medium text-black/60 hover:border-black/30 hover:text-black disabled:opacity-50 dark:border-white/15 dark:text-white/60 dark:hover:border-white/40 dark:hover:text-white"
            >
              ↩ {isUndoing ? "Отменяем…" : `Отменить оценку «${lastGraded.front}»`}
            </button>
          </div>
        )}
        <SessionComplete
          count={cards.length}
          newRecord={newRecord}
          missionId={missionId}
          missionCorrectCount={tally[2] + tally[3]}
          missionIncorrectCount={tally[0] + tally[1]}
          // Review mockup alignment — реальные слова этой сессии (front —
          // всегда язык изучения, back — родной, см. комментарий у speak()
          // выше), не новый запрос: cards уже в состоянии этого компонента.
          // SessionComplete — прямой ребёнок этого файла (не через
          // review-mode-switcher.tsx), так что новый проп не требует правок
          // вне заявленных двух файлов.
          cards={cards.map((c) => ({ front: c.front, back: c.back }))}
        />
      </>
    );
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
      {/* Review mockup alignment — 3-колоночный верх (X слева / точки по
          центру / стрик справа), вместо прежнего 2-колоночного (точки+счётчик
          слева, X справа). Числовая подпись "X / Y · осталось Z" вынесена
          отдельной строкой под рядом — точки дают ощущение прогресса на
          взгляд, подпись даёт точное число, ни одно не потеряно. */}
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={exitSession}
          aria-label="Завершить сессию"
          title="Выйти (Esc)"
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-black dark:hover:text-white"
        >
          ✕
        </button>
        {/* Точки прогресса — одна на карточку, forest-light для пройденных
            (включая текущую), приглушённая для оставшихся. flex-wrap —
            большие сессии (20+ карточек) переносятся на вторую строку
            вместо растягивания/переполнения, а не обрезаются. */}
        <div
          className="flex flex-wrap items-center justify-center gap-1"
          role="img"
          aria-label={`Карточка ${index + 1} из ${cards.length}`}
        >
          {cards.map((c, i) => (
            <span
              key={c.flashcardId}
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${i <= index ? "bg-[var(--color-forest-light)]" : "bg-[var(--border-strong)]"}`}
            />
          ))}
        </div>
        {/* Стрик — только когда реально >0 (getCurrentStreak(), та же
            server action, что session-complete.tsx уже вызывает): нет
            смысла показывать "🔥 0", а до первого resolve просто пусто —
            ничего не выдумываем, ничего не мигает разметкой-заглушкой. */}
        <div className="flex min-h-9 min-w-9 shrink-0 items-center justify-end">
          {streak !== null && streak > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]"
              title={`Стрик: ${streak} ${streak === 1 ? "день" : "дней"} подряд`}
            >
              <Flame aria-hidden="true" className="h-3.5 w-3.5 text-orange-500" />
              {streak}
            </span>
          )}
        </div>
      </div>
      <p className="mb-4 text-center text-sm text-[var(--text-secondary)]">
        {index + 1} / {cards.length}
        {cards.length - index - 1 > 0 && <span> · осталось {cards.length - index - 1}</span>}
      </p>

      {lastGraded && (
        <button
          type="button"
          onClick={undo}
          disabled={isUndoing}
          className="mb-4 flex min-h-9 items-center justify-center gap-1 self-center rounded-full border border-black/10 px-3 text-xs font-medium text-black/60 hover:border-black/30 hover:text-black disabled:opacity-50 dark:border-white/15 dark:text-white/60 dark:hover:border-white/40 dark:hover:text-white"
        >
          ↩ {isUndoing ? "Отменяем…" : `Отменить оценку «${lastGraded.front}»`}
        </button>
      )}

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
              className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-forest text-sm font-medium text-white disabled:opacity-50"
            >
              {editPending ? "…" : "Сохранить"}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Review mockup alignment — приподнятая карточка на
              --surface-elevated/--border (тот же токен-язык, что уже принят
              для /read), радиус 22px, мягкая тонированная тень (нет
              литерального var(--shadow) в токенах — тот же приём "имени нет,
              значение то же по духу", что --surface-elevated уже применял на
              /read). */}
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[22px] border border-[var(--border)] bg-[var(--surface-elevated)] px-[18px] py-[30px] text-center shadow-[0_18px_60px_rgba(80,60,35,0.06)]">
            <div className="flex items-center gap-2">
              <p className="text-[25px] font-bold">{question}</p>
              {speechAvailable && (
                <button
                  type="button"
                  onClick={speak}
                  aria-label="Произнести"
                  className="flex min-h-9 min-w-9 items-center justify-center text-[var(--text-secondary)] hover:text-black dark:hover:text-white"
                >
                  🔊
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label="Редактировать карточку"
                className="flex min-h-9 min-w-9 items-center justify-center text-[var(--text-secondary)] hover:text-black dark:hover:text-white"
              >
                ✎
              </button>
            </div>

            {revealed && (
              <div className="flip-reveal flex flex-col items-center gap-2">
                {card.photoUrl && (
                  // unoptimized: card.photoUrl — приватный Supabase Storage
                  // signed URL с TTL в час (word-row.tsx); next/image's
                  // серверный оптимизатор кеширует результат дольше этого
                  // TTL, так что доменная оптимизация тут бессмысленна и
                  // потенциально ломается на просроченной ссылке.
                  // width/height + style auto: официальный next/image-паттерн
                  // для картинки с заранее неизвестным (пользовательским)
                  // соотношением сторон — ведёт себя как обычный <img>
                  // с max-h-40, не как fill.
                  <Image
                    src={card.photoUrl}
                    alt=""
                    width={400}
                    height={400}
                    unoptimized
                    className="max-h-40 w-auto rounded-lg object-cover"
                    style={{ width: "auto", height: "auto" }}
                  />
                )}
                <p className="text-[12px] text-[var(--text-secondary)]">{answer}</p>
                {card.notes && (
                  <p className="max-w-sm text-sm text-[var(--text-secondary)]">{card.notes}</p>
                )}
                {/* Review mockup alignment — italic/11.5px/faint, без прежней
                    закрашенной пилюли-фона (референс просит только
                    типографику). Playfair/Source Serif здесь сознательно не
                    подключаем: "use client"-компонент, next/font/google в
                    таком контексте не задокументирован явно (сверено с
                    node_modules/next/dist/docs/), а протянуть шрифт через
                    Server Component предка означало бы править
                    review-mode-switcher.tsx — вне границ задачи. Курсив на
                    существующем sans-стеке — тот же компромисс, что и в
                    заголовке session-complete.tsx ниже. */}
                {card.contextSentence && (
                  <div className="max-w-sm">
                    <p className="italic text-[11.5px] text-[var(--text-secondary)]">{card.contextSentence}</p>
                    {card.contextTranslation && (
                      <p className="mt-0.5 text-[11.5px] text-[var(--text-secondary)]">{card.contextTranslation}</p>
                    )}
                  </div>
                )}
                {card.sourceTextId && card.sourceTextTitle && (
                  <a
                    href={`/read/${card.sourceTextId}`}
                    className="text-xs font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
                  >
                    из «{card.sourceTextTitle}»
                  </a>
                )}
                <button
                  type="button"
                  onClick={handleSendToNotebook}
                  disabled={notebookStatus === "saving" || notebookStatus === "done"}
                  className="mt-1 text-xs font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-black hover:underline disabled:no-underline disabled:opacity-60 dark:hover:text-white"
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
            // Review mockup alignment — единый forest-акцент вместо
            // чёрного/белого CTA, тот же паттерн, что уже применён на
            // /home, /read и /library в этой серии задач (референс это
            // явно не описывает, но чёрно-белые кнопки — тот самый дрейф от
            // бренда, что зачищался на каждом предыдущем экране).
            <button
              type="button"
              onClick={revealAnswer}
              className="mt-4 rounded-full bg-[var(--color-forest)] px-5 py-3 font-medium text-white"
            >
              Показать ответ
            </button>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {bestSessionCount > 0 && (
                <div>
                  <p className="text-center text-xs text-[var(--text-secondary)]">
                    Сегодня {sessionTotal} · рекорд {Math.max(bestSessionCount, sessionTotal)}
                  </p>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-forest transition-[width]"
                      style={{
                        width: `${Math.min(100, (sessionTotal / Math.max(bestSessionCount, 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              {/* Review mockup alignment — 4 в ряд вместо 2×2, радиус 16px
                  вместо pill, тень снизу под каждой кнопкой. previewDays/
                  formatInterval() ниже — та же самая формула, что и раньше,
                  не тронута, только разметка вокруг неё. */}
              <div className="grid grid-cols-4 gap-2">
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
                    className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl px-[3px] py-[10px] text-center font-medium text-white shadow-[0_4px_10px_-2px_rgba(0,0,0,0.3)] transition-opacity disabled:opacity-50 ${g.className}`}
                  >
                    <span className="text-xs leading-tight">{g.label}</span>
                    {/* M3 Slice 4.1: opacity-80 white blended over these
                        backgrounds dropped as low as 2.32:1 (found via
                        axe-core) — full-opacity white stays legible (same
                        ratio as the label above) and de-emphasis still
                        comes through via the smaller text-xs size. */}
                    <span className="text-[10px] font-normal leading-tight">{formatInterval(previewDays)}</span>
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
      <div className="mt-4 flex justify-center gap-3 text-xs text-[var(--text-secondary)]">
        <span>❌ {tally[0]}</span>
        <span>🟠 {tally[1]}</span>
        <span>✅ {tally[2]}</span>
        <span>⭐ {tally[3]}</span>
      </div>

      {/* M3 Slice 4 §6: клавиатурные подсказки — desktop only, мобильным
          пользователям это неактуально (нет физической клавиатуры). */}
      <p className="mt-2 hidden justify-center gap-2 text-center text-[11px] text-[var(--text-secondary)] sm:flex">
        <span>Пробел — ответ</span>
        <span>·</span>
        <span>1–4 — оценка</span>
        <span>·</span>
        <span>Esc — выход</span>
      </p>
    </div>
  );
}
