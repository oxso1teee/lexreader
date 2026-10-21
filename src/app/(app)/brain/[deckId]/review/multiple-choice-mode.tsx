"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X, Check, Volume2 } from "lucide-react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import { Button } from "@/components/ui/button";
import SessionComplete from "./session-complete";
import { useMoments } from "@/components/product/moments/moment-provider";
import { haptic, playReviewSound } from "@/lib/native";
import { useRouter } from "next/navigation";

// docs/moments/mockups/Lesson-choice.dc.html, reference/Lesson-choice.png.
const COMBO_THRESHOLD = 5;

// review-session.tsx имеет тот же паттерн и подробный комментарий о том,
// почему: голый "typeof window !== 'undefined' && …" внутри тела рендера
// валиден на сервере (false) и может стать true уже на первом клиентском
// рендере — настоящий hydration mismatch, не просто lint-придирка (нашёл
// живьём: клик по варианту ответа не доходил до choose() из-за сорванной
// гидрации).
function subscribeNoop(): () => void {
  return () => {};
}
function getSpeechSnapshot(): boolean {
  return "speechSynthesis" in window;
}
function getSpeechServerSnapshot(): boolean {
  return false;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// P0-АУДИТ 3.12 (испр.): answerOf() определяет, какая сторона карточки
// сейчас считается "ответом" — с учётом направления изучения, а не всегда
// card.back (единственный режим, который уже был согласован с
// направлением, но не переиспользовал общую функцию).
function answerOf(card: ReviewCard, studyDirection: "front_back" | "back_front"): string {
  return studyDirection === "back_front" ? card.front : card.back;
}
function questionOf(card: ReviewCard, studyDirection: "front_back" | "back_front"): string {
  return studyDirection === "back_front" ? card.back : card.front;
}

function buildOptions(cards: ReviewCard[], studyDirection: "front_back" | "back_front"): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const card of cards) {
    const answer = answerOf(card, studyDirection);
    const distractorPool = cards.filter(
      (c) => c.flashcardId !== card.flashcardId && answerOf(c, studyDirection) !== answer,
    );
    const distractors = shuffle(distractorPool)
      .slice(0, 3)
      .map((c) => answerOf(c, studyDirection));
    map.set(card.flashcardId, shuffle([answer, ...distractors]));
  }
  return map;
}

export default function MultipleChoiceMode({
  cards,
  studyDirection,
  missionId = null,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  missionId?: string | null;
}) {
  const router = useRouter();
  const { pushMoments } = useMoments();
  // Варианты считаем один раз от полного пула карточек (не от очереди ниже,
  // которая растёт при неверных ответах) — иначе у requeue-повтора не из
  // чего брать дистракторы.
  const [optionsByCard] = useState(() => buildOptions(cards, studyDirection));
  // docs/moments/mockups/Lesson-choice.dc.html — "Слово вернётся в конце
  // занятия": не фиксированный cards/index, а очередь, в конец которой
  // неверный ответ добавляет карточку ещё раз (один повтор на карточку —
  // requeuedIds ниже не даёт зациклиться на упорно неверном ответе).
  const [queue, setQueue] = useState<ReviewCard[]>(cards);
  const [queueIndex, setQueueIndex] = useState(0);
  const requeuedIds = useState(() => new Set<string>())[0];
  const correctIds = useState(() => new Set<string>())[0];
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [combo, setCombo] = useState(0);
  const [xpAwarded, setXpAwarded] = useState(0);
  // Реальный per-card grade (2/0), тот же, что уходит в reviewWord() ниже —
  // не отдельная метрика, а просто накопленный счёт для миссии (§11-13).
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  const reduceMotion = useReducedMotion();
  const speechAvailable = useSyncExternalStore(subscribeNoop, getSpeechSnapshot, getSpeechServerSnapshot);

  const done = queueIndex >= queue.length;
  const card = queue[queueIndex];
  const options = card ? optionsByCard.get(card.flashcardId) ?? [] : [];

  if (done) {
    return (
      <SessionComplete
        count={cards.length}
        missionId={missionId}
        missionCorrectCount={tally.correct}
        missionIncorrectCount={tally.incorrect}
      />
    );
  }

  // P0-АУДИТ (раздел 4): при малом числе карточек в сессии (частый случай в
  // первый день) неоткуда брать неправильные варианты — "квиз" из одной
  // кнопки ничего не проверяет. Честно предлагаем другой режим вместо этого.
  if (options.length < 2) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-xl font-semibold">Пока маловато карточек</p>
        <p className="text-[var(--text-secondary)]">
          Для режима &laquo;Выбор&raquo; нужно больше карточек, чтобы было из чего выбирать.
          Попробуй режим &laquo;Карточки&raquo; или добавь ещё слов.
        </p>
      </div>
    );
  }

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    const isCorrect = option === answerOf(card, studyDirection);
    const grade = isCorrect ? 2 : 0;
    const wasAlreadyRequeued = requeuedIds.has(card.flashcardId);
    setTally((t) => (isCorrect ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    void haptic(isCorrect ? "success" : "warning");
    playReviewSound(isCorrect ? "correct" : "incorrect");
    if (isCorrect) {
      correctIds.add(card.flashcardId);
      setCombo((c) => c + 1);
    } else {
      setCombo(0);
      if (!wasAlreadyRequeued) {
        requeuedIds.add(card.flashcardId);
        setQueue((q) => [...q, card]);
      }
    }
    startTransition(async () => {
      // Найдено живьём: исходный код тут был "void reviewWord(...)"
      // (fire-and-forget, молча проглатывал отказ) — await без try/catch
      // превращает сетевой сбой/протухшую сессию в падение всего экрана
      // через ErrorBoundary вместо потери одного +XP-баннера.
      try {
        const result = await reviewWord(card.flashcardId, grade, "choice");
        setXpAwarded(result.xpAwarded);
        if (result.moments.length > 0) pushMoments(result.moments);
      } catch {
        setXpAwarded(0);
      }
    });
  }

  function next() {
    setSelected(null);
    setXpAwarded(0);
    setQueueIndex((i) => i + 1);
  }

  const correctAnswer = answerOf(card, studyDirection);
  const progressDone = correctIds.size;
  const progressTotal = cards.length;
  const isCorrect = selected !== null && selected === correctAnswer;
  const willReturnLater = selected !== null && !isCorrect && requeuedIds.has(card.flashcardId);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-6">
      <div className="mb-5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => router.push("/brain")}
          aria-label="Закрыть занятие"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-foreground"
        >
          <X aria-hidden="true" className="h-6 w-6" />
        </button>
        <div
          className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-label="Прогресс занятия"
          aria-valuemin={0}
          aria-valuemax={progressTotal}
          aria-valuenow={progressDone}
        >
          <div
            className="h-full rounded-full bg-[var(--color-forest)] transition-[width] duration-300"
            style={{ width: `${(progressDone / progressTotal) * 100}%` }}
          />
        </div>
        {combo > 0 && (
          <span
            aria-label="Серия верных ответов"
            className="flex shrink-0 items-center gap-1 pr-1.5 text-[15px] font-bold"
            style={{ color: "#c2410c" }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
            </svg>
            {combo}
          </span>
        )}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sky-text)" }}>
        {card.repetitions === 0 ? "Новое слово" : "Повторение"} · задание {queueIndex + 1} из {queue.length}
      </div>
      <h1 className="mo-disp" style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>
        {studyDirection === "back_front" ? "Что значит выделенное слово?" : "Выбери перевод"}
      </h1>

      <div className="mo-card" style={{ marginTop: 18, padding: 16, display: "flex", gap: 12, alignItems: "flex-start" }}>
        {speechAvailable && (
          <button
            type="button"
            onClick={() => {
              const utterance = new SpeechSynthesisUtterance(card.front);
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(utterance);
            }}
            aria-label="Произнести"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--sky)", boxShadow: "inset 0 -4px 0 0 var(--sky-edge)" }}
          >
            <Volume2 aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
        <div>
          {card.contextSentence ? (
            // review-session.tsx имеет тот же компромисс (см. комментарий там
            // у контекстного предложения): next/font/google Source Serif 4
            // подключён только в /read/[textId] (--font-reading), а не
            // глобально — здесь курсив на обычном sans-стеке, не несуществующая
            // переменная шрифта.
            <p className="italic" style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>
              {card.contextSentence}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 19, fontWeight: 600 }}>{questionOf(card, studyDirection)}</p>
          )}
          {card.sourceTextTitle && (
            <div className="mo-muted" style={{ fontSize: 12, marginTop: 6 }}>
              из «{card.sourceTextTitle}»
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
        {options.map((opt, i) => {
          const isOptCorrect = opt === correctAnswer;
          const showState = selected !== null;
          const isSelectedWrong = showState && opt === selected && !isOptCorrect;
          const style = !showState
            ? { borderColor: "var(--border-strong)", background: "var(--surface)" }
            : isOptCorrect
              ? { borderColor: "var(--color-forest)", background: "var(--color-forest-tint)", color: "var(--color-forest-text)" }
              : isSelectedWrong
                ? { borderColor: "var(--color-danger-text)", background: "var(--danger-tint)", color: "var(--color-danger-text)" }
                : { borderColor: "var(--border)", background: "var(--surface)", opacity: 0.5 };
          return (
            <motion.button
              key={opt}
              type="button"
              disabled={showState}
              onClick={() => choose(opt)}
              animate={showState && isOptCorrect && !reduceMotion ? { scale: [1, 1.035, 1] } : { scale: 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              style={{ ...style, borderWidth: 2, borderStyle: "solid", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", fontSize: 17, fontWeight: 600 }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: "2px solid currentColor",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  opacity: 0.7,
                  flex: "none",
                }}
              >
                {i + 1}
              </span>
              <span style={{ flex: 1 }}>{opt}</span>
              {showState && isOptCorrect && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
              {isSelectedWrong && <X aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </motion.button>
          );
        })}
      </div>

      {selected !== null && (
        <p role="status" aria-live="polite" className="sr-only">
          {isCorrect ? "Верно!" : `Неверно. Правильный ответ: ${correctAnswer}`}
        </p>
      )}

      {selected !== null && (
        <div
          className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4"
          style={{ background: isCorrect ? "var(--color-forest-tint)" : "var(--danger-tint)", animation: "mo-rise 0.22s ease-out" }}
          role="status"
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: "var(--surface)",
                color: isCorrect ? "var(--color-forest)" : "var(--color-danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              {isCorrect ? <Check aria-hidden="true" className="h-6 w-6" strokeWidth={3} /> : <X aria-hidden="true" className="h-6 w-6" strokeWidth={3} />}
            </div>
            <div style={{ flex: 1 }}>
              <div className="mo-disp" style={{ fontSize: 20, fontWeight: 700, color: isCorrect ? "var(--color-forest-text)" : "var(--color-danger-text)" }}>
                {isCorrect ? "Отлично!" : "Не совсем"}
              </div>
              {isCorrect ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-forest-text)" }}>
                  +{xpAwarded} XP{combo >= COMBO_THRESHOLD ? ` · ${combo} верных подряд` : ""}
                </div>
              ) : (
                <div style={{ fontSize: 15, color: "var(--color-danger-text)", marginTop: 2 }}>
                  Правильно: <b>{correctAnswer}</b>.{willReturnLater ? " Слово вернётся в конце занятия." : ""}
                </div>
              )}
            </div>
          </div>
          <Button variant={isCorrect ? "leaf" : "danger"} disabled={isPending} onClick={next} className="mo-cta">
            {isCorrect ? "Продолжить" : "Понятно"}
          </Button>
        </div>
      )}
    </div>
  );
}
