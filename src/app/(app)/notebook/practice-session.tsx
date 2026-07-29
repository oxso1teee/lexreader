"use client";

import { useRef, useState } from "react";
import EmptyState from "./empty-state";

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 6.3: порог смещения в
// пикселях, после которого отпускание считается свайпом, а не просто тапом.
const SWIPE_THRESHOLD_PX = 80;

export interface PracticeWord {
  id: string;
  headword: string;
  translation: string;
}

// Лёгкий режим практики слов из Тетради — без SM-2 и без сохранения между
// визитами (см. раздел 13 ТЗ): просто прогон по словам с счётчиками
// знаю/не знаю/осталось за текущую сессию. Настоящее интервальное повторение
// живёт отдельно в «Мозге».
export default function PracticeSession({ words }: { words: PracticeWord[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);

  if (words.length === 0) {
    return <EmptyState />;
  }

  const remaining = words.length - index;
  const word = words[index];
  const done = index >= words.length;

  function reset() {
    setIndex(0);
    setRevealed(false);
    setKnown(0);
    setUnknown(0);
  }

  function mark(isKnown: boolean) {
    if (isKnown) setKnown((n) => n + 1);
    else setUnknown((n) => n + 1);
    setRevealed(false);
    setDragX(0);
    setIndex((i) => i + 1);
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!revealed) return;
    dragging.current = true;
    startX.current = e.clientX;
    setIsDragging(true);
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    setDragX(e.clientX - startX.current);
  }
  function handlePointerUp() {
    if (!dragging.current) return;
    dragging.current = false;
    setIsDragging(false);
    if (dragX > SWIPE_THRESHOLD_PX) mark(true);
    else if (dragX < -SWIPE_THRESHOLD_PX) mark(false);
    else setDragX(0);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-black/10 px-1 pb-3 text-sm dark:border-white/10">
        <span className="text-emerald-600 dark:text-emerald-400">✓ {known} знаю</span>
        <span className="text-red-600 dark:text-red-400">✗ {unknown} не знаю</span>
        <span className="text-amber-600 dark:text-amber-400">★ {Math.max(remaining, 0)} в деке</span>
        <button
          type="button"
          onClick={reset}
          className="flex min-h-11 items-center justify-center rounded-full border border-black/15 px-3 text-xs font-medium dark:border-white/20"
        >
          Сброс
        </button>
      </div>

      {done ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-lg font-bold">Пройдено!</p>
          <p className="text-sm text-black/50 dark:text-white/50">
            Знаю: {known} · Не знаю: {unknown}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 rounded-full bg-caramel px-5 py-2.5 text-sm font-medium text-white"
          >
            Пройти ещё раз
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              transform: `translateX(${dragX}px) rotate(${dragX / 20}deg)`,
              transition: isDragging ? "none" : "transform 0.2s ease-out",
              touchAction: revealed ? "none" : undefined,
            }}
          >
            <p className="text-2xl font-semibold">{word.headword}</p>
            {revealed && (
              <p className="mt-2 text-lg text-black/60 dark:text-white/60">{word.translation}</p>
            )}
            {revealed && (
              <p className="mt-2 text-xs text-black/30 dark:text-white/30">
                ← смахни, чтобы отметить →
              </p>
            )}
          </div>

          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
            >
              Показать перевод
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => mark(false)}
                className="rounded-full bg-red-600 px-5 py-3 font-medium text-white hover:bg-red-500"
              >
                ✗ Не знаю
              </button>
              <button
                type="button"
                onClick={() => mark(true)}
                className="rounded-full bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-500"
              >
                ✓ Знаю
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
