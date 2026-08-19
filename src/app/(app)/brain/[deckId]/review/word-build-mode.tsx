"use client";

import { useMemo, useState, useTransition } from "react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import SessionComplete from "./session-complete";

// Gamified redesign — "Word Practice" from the reference (listen/read the
// prompt, tap letter tiles in order to build the target word). Same
// per-card state/grading shape as TypeWordMode (type-word-mode.tsx), just
// swapping free typing for tile taps — graded through the same reviewWord()
// pipeline with its own "build" practice_mode (see
// src/lib/vocabulary/state-engine.ts: reconstruction-from-given-letters is
// grouped with the other WEAK_EVIDENCE_MODES, not with Type's from-nothing
// recall).

interface Tile {
  id: number;
  char: string;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Deterministic-enough anti-trivial-order shuffle: keep reshuffling a
// fresh copy until it differs from the answer's own order (only matters
// for very short words where a naive shuffle can land on the identity
// permutation and make the "game" a single tap).
function shuffledTiles(answer: string): Tile[] {
  const chars = answer.split("");
  const base: Tile[] = chars.map((char, id) => ({ id, char }));
  if (base.length <= 1) return base;
  let attempt = shuffle(base);
  let guard = 0;
  while (attempt.map((t) => t.char).join("") === answer && guard < 10) {
    attempt = shuffle(base);
    guard += 1;
  }
  return attempt;
}

export default function WordBuildMode({
  cards,
  studyDirection,
  missionId = null,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  missionId?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<Tile[]>([]);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });

  const done = index >= cards.length;
  const card = cards[index];
  // Same question/answer mapping convention as TypeWordMode: the word
  // to reconstruct is always the "answer" side for the current direction.
  const question = studyDirection === "back_front" ? card?.back : card?.front;
  const answer = (studyDirection === "back_front" ? card?.front : card?.back) ?? "";

  const pool = useMemo(() => shuffledTiles(answer.trim().toLowerCase()), [answer]);
  const [bank, setBank] = useState<Tile[]>(pool);

  // Re-derive bank/placed whenever we move to a new card (pool changes
  // identity via useMemo's [answer, index] deps).
  const [seenIndex, setSeenIndex] = useState(index);
  if (seenIndex !== index) {
    setSeenIndex(index);
    setBank(pool);
    setPlaced([]);
  }

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

  const builtWord = placed.map((t) => t.char).join("");
  const normalizedAnswer = answer.trim().toLowerCase();

  function placeTile(tile: Tile) {
    if (result) return;
    setBank((b) => b.filter((t) => t.id !== tile.id));
    setPlaced((p) => [...p, tile]);
  }

  function removeTile(tile: Tile) {
    if (result) return;
    setPlaced((p) => p.filter((t) => t.id !== tile.id));
    setBank((b) => [...b, tile]);
  }

  function check() {
    if (result || builtWord.length === 0) return;
    const isCorrect = builtWord === normalizedAnswer;
    setResult(isCorrect ? "correct" : "wrong");
    setTally((t) => (isCorrect ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    startTransition(() => {
      void reviewWord(card.flashcardId, isCorrect ? 2 : 0, "build");
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setResult(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        {index + 1} / {cards.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-semibold">{question}</p>
        <p className="text-caption text-[var(--text-secondary)]">Собери слово из букв</p>
        {result && (
          <p
            role="status"
            aria-live="polite"
            className={`flex items-center gap-1.5 font-medium ${
              result === "correct" ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            <span aria-hidden="true">{result === "correct" ? "✓" : "✗"}</span>
            {result === "correct" ? "Верно!" : `Правильный ответ: ${answer}`}
          </p>
        )}
      </div>

      {/* Answer slots -- tapped tiles land here in order */}
      <div
        className={`mb-4 flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-xl border-2 border-dashed p-3 ${
          result === "correct"
            ? "border-emerald-600 dark:border-emerald-500"
            : result === "wrong"
              ? "border-red-500"
              : "border-[var(--border)]"
        }`}
      >
        {placed.length === 0 && <span className="text-sm text-[var(--text-secondary)]">Нажимай на буквы ниже</span>}
        {placed.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => removeTile(tile)}
            disabled={!!result}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--color-primary)] text-lg font-bold text-[var(--color-primary-foreground)] disabled:opacity-70"
            aria-label={`Убрать букву ${tile.char}`}
          >
            {tile.char}
          </button>
        ))}
      </div>

      {/* Letter bank */}
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {bank.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => placeTile(tile)}
            disabled={!!result}
            className="focus-ring flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-lg font-bold disabled:opacity-40"
            aria-label={`Буква ${tile.char}`}
          >
            {tile.char}
          </button>
        ))}
      </div>

      {result ? (
        <button
          type="button"
          onClick={next}
          disabled={isPending}
          className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Далее
        </button>
      ) : (
        <button
          type="button"
          onClick={check}
          disabled={builtWord.length === 0}
          className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
        >
          Проверить
        </button>
      )}
    </div>
  );
}
