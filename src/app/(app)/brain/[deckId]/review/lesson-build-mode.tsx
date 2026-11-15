"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Check, Volume2 } from "lucide-react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import { Button } from "@/components/ui/button";
import SessionComplete from "./session-complete";
import { useMoments } from "@/components/product/moments/moment-provider";
import { haptic, playReviewSound } from "@/lib/native";
import { buildPhraseExercise, checkPhraseAnswer, type BuildPhraseExercise } from "@/lib/lesson-exercises";

// docs/moments/mockups/Lesson-build.dc.html — "Собери перевод": фраза на
// изучаемом языке (contextSentence, если есть у карточки, иначе само слово)
// произносится/показывается сверху, пользователь складывает перевод из
// тайлов (ответ + немного тайлов-пустышек из переводов других карточек).

// review-session.tsx/multiple-choice-mode.tsx — тот же паттерн и тот же
// подробный комментарий о hydration mismatch, который чинит
// useSyncExternalStore вместо голого `typeof window`.
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

function promptOf(card: ReviewCard): string {
  return card.contextSentence ?? card.front;
}
function answerOf(card: ReviewCard): string {
  return card.contextTranslation ?? card.back;
}

function buildExercises(cards: ReviewCard[]): Map<string, BuildPhraseExercise> {
  const map = new Map<string, BuildPhraseExercise>();
  for (const card of cards) {
    const distractors = cards.filter((c) => c.flashcardId !== card.flashcardId).map((c) => answerOf(c));
    map.set(card.flashcardId, buildPhraseExercise(promptOf(card), answerOf(card), distractors, shuffle));
  }
  return map;
}

export default function LessonBuildMode({
  cards,
  missionId = null,
}: {
  cards: ReviewCard[];
  missionId?: string | null;
}) {
  const router = useRouter();
  const { pushMoments } = useMoments();
  // Упражнения считаем один раз от полного набора карточек — дистракторы
  // берутся из всего пула, а не из того, что осталось в очереди.
  const [exercisesByCard] = useState(() => buildExercises(cards));
  const [index, setIndex] = useState(0);
  // Доступные тайлы (ещё не выбранные) и уже выбранная пользователем
  // последовательность — тот же подход, что в Lesson-build.dc.html
  // ("used"-тайлы становятся прозрачными вместо того, чтобы исчезать).
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [xpAwarded, setXpAwarded] = useState(0);
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  const speechAvailable = useSyncExternalStore(subscribeNoop, getSpeechSnapshot, getSpeechServerSnapshot);

  const done = index >= cards.length;
  const card = cards[index];
  const exercise = card ? exercisesByCard.get(card.flashcardId) : undefined;

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

  if (!exercise || exercise.solution.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-xl font-semibold">Пока нечего собирать</p>
        <p className="text-[var(--text-secondary)]">
          Для режима «Собери фразу» нужен перевод у карточки. Попробуй другой режим.
        </p>
      </div>
    );
  }

  // Переприсваиваем в новую переменную: TS не переносит сужение `exercise`
  // (из guard выше) в замыкания ниже (check()/tapTile()) — `ex` же получает
  // уже сужённый, не-undefined тип в момент этого присваивания.
  const ex = exercise;
  const isCorrect = checked && checkPhraseAnswer(picked.map((i) => ex.tiles[i]), ex.solution);

  function tapTile(tileIndex: number) {
    if (checked || picked.includes(tileIndex)) return;
    setPicked((p) => [...p, tileIndex]);
  }

  function removeLast() {
    if (checked) return;
    setPicked((p) => p.slice(0, -1));
  }

  function speak() {
    if (!speechAvailable || !card) return;
    const utterance = new SpeechSynthesisUtterance(promptOf(card));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function check() {
    if (checked || picked.length === 0) return;
    const correct = checkPhraseAnswer(picked.map((i) => ex.tiles[i]), ex.solution);
    setChecked(true);
    setTally((t) => (correct ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    void haptic(correct ? "success" : "warning");
    playReviewSound(correct ? "correct" : "incorrect");
    startTransition(async () => {
      try {
        const result = await reviewWord(card.flashcardId, correct ? 2 : 0, "build");
        setXpAwarded(result.xpAwarded);
        if (result.moments.length > 0) pushMoments(result.moments);
      } catch {
        setXpAwarded(0);
      }
    });
  }

  function next() {
    setPicked([]);
    setChecked(false);
    setXpAwarded(0);
    setIndex((i) => i + 1);
  }

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
          aria-valuemax={cards.length}
          aria-valuenow={index}
        >
          <div
            className="h-full rounded-full bg-[var(--color-forest)] transition-[width] duration-300"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--sky-text)" }}>
        Перевод · задание {index + 1} из {cards.length}
      </div>
      <h1 className="mo-disp" style={{ margin: "8px 0 0", fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>
        Собери перевод
      </h1>

      <div className="mo-card" style={{ marginTop: 18, padding: 16, display: "flex", gap: 10, alignItems: "center" }}>
        {speechAvailable && (
          <button
            type="button"
            onClick={speak}
            aria-label="Прослушать"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: "var(--sky)", boxShadow: "inset 0 -4px 0 0 var(--sky-edge)" }}
          >
            <Volume2 aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
        <p data-testid="build-prompt" style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>
          {ex.promptText}
        </p>
      </div>

      {/* Собранная пользователем последовательность. */}
      <div
        className="flex min-h-[64px] flex-wrap gap-2 border-y-2 border-[var(--border)] py-3"
        style={{ marginTop: 22 }}
        role="group"
        aria-label="Собранный ответ"
      >
        {picked.map((tileIndex, i) => (
          <button
            key={`${tileIndex}-${i}`}
            type="button"
            disabled={checked}
            onClick={i === picked.length - 1 ? removeLast : undefined}
            data-testid={`build-picked-${i}`}
            className="min-h-11 rounded-2xl border-2 border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-[17px] font-semibold shadow-[inset_0_-4px_0_0_var(--border)]"
          >
            {ex.tiles[tileIndex]}
          </button>
        ))}
      </div>

      {/* Доступные тайлы. */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {ex.tiles.map((tile, i) => {
          const used = picked.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={used || checked}
              onClick={() => tapTile(i)}
              data-testid={`build-tile-${i}`}
              className={`min-h-11 rounded-2xl border-2 px-3.5 py-2 text-[17px] font-semibold transition-opacity ${
                used
                  ? "border-[var(--surface-muted)] bg-[var(--surface-muted)] text-transparent"
                  : "border-[var(--border-strong)] bg-[var(--surface)] shadow-[inset_0_-4px_0_0_var(--border)]"
              }`}
            >
              {tile}
            </button>
          );
        })}
      </div>

      {!checked ? (
        <Button variant="leaf" onClick={check} disabled={picked.length === 0} className="mt-6">
          Проверить
        </Button>
      ) : (
        <div
          className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-5 pb-[calc(18px+env(safe-area-inset-bottom))] pt-4"
          style={{ background: isCorrect ? "var(--color-forest-tint)" : "var(--danger-tint)" }}
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
                {isCorrect ? "Отлично!" : "Правильный ответ:"}
              </div>
              {isCorrect ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-forest-text)" }}>+{xpAwarded} XP</div>
              ) : (
                <div style={{ fontSize: 15, color: "var(--color-danger-text)", marginTop: 2 }}>{ex.solution.join(" ")}</div>
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
