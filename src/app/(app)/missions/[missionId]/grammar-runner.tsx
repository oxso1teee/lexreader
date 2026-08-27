"use client";

import { useState, useTransition } from "react";
import { submitMissionStepAction, completeMissionAction, type CompleteMissionResult } from "../actions";
import { track } from "@/lib/posthog-client";
import type { GrammarQuestion } from "@/lib/missions/grammar-bank";
import type { MissionAttemptRow, MissionType } from "@/lib/missions/types";

// Deterministic multiple-choice runner for grammar_pattern/correction/
// diagnostic_followup/maintenance missions (plan doc §9) — no LLM, no free
// text grading, questions come frozen from mission.payload_json. Mirrors
// brain/[deckId]/review/multiple-choice-mode.tsx's feedback pattern
// (non-color-only: icon + text + aria-live), not a rewrite of that file
// since this runs against payload questions, not flashcards/FSRS.
export default function GrammarRunner({
  missionId,
  missionType,
  questions,
  initialAttempt,
  onComplete,
}: {
  missionId: string;
  missionType: MissionType;
  questions: GrammarQuestion[];
  initialAttempt: MissionAttemptRow;
  onComplete: (result: CompleteMissionResult | null) => void;
}) {
  // Server-authoritative resume (plan doc §8): current_step is the source of
  // truth, not localStorage — a reload picks up exactly where the last
  // submitted answer left off.
  const [index, setIndex] = useState(Math.min(initialAttempt.current_step, questions.length));
  const [selected, setSelected] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const done = index >= questions.length;
  const q = questions[index];

  if (done || !q) {
    return <p className="text-sm text-[var(--text-secondary)]">Завершаем…</p>;
  }

  function choose(optionIndex: number) {
    if (selected !== null || isPending) return;
    setSelected(optionIndex);
    const correct = optionIndex === q.correctIndex;
    startTransition(async () => {
      await submitMissionStepAction(missionId, index, correct, optionIndex);
      track("mission_step_completed", { mission_type: missionType, step_index: index, correct });
    });
  }

  function next() {
    if (index + 1 >= questions.length) {
      startTransition(async () => {
        const result = await completeMissionAction(missionId);
        track("mission_completed", { mission_type: missionType });
        onComplete(result);
      });
    } else {
      setSelected(null);
      setIndex((i) => i + 1);
    }
  }

  const correctAnswer = q.options[q.correctIndex];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Вопрос {index + 1} из {questions.length}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span
          className="block h-full rounded-full bg-forest transition-[width]"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium">{q.prompt}</p>
        {selected !== null && (
          <p role="status" aria-live="polite" className="sr-only">
            {selected === q.correctIndex ? "Верно!" : `Неверно. Правильный ответ: ${correctAnswer}`}
          </p>
        )}
        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => {
            const showState = selected !== null;
            const isCorrect = i === q.correctIndex;
            const isSelectedWrong = showState && i === selected && !isCorrect;
            const stateClass = !showState
              ? "border-[var(--border-strong)] hover:border-black/30 dark:hover:border-white/40"
              : isCorrect
                ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950"
                : isSelectedWrong
                  ? "border-red-500 bg-red-50 dark:bg-red-950"
                  : "border-[var(--border-strong)] opacity-50";
            return (
              <button
                key={i}
                type="button"
                disabled={showState}
                onClick={() => choose(i)}
                className={`focus-ring flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${stateClass}`}
              >
                <span>{opt}</span>
                {showState && isCorrect && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <span aria-hidden="true">✓</span> Верно
                  </span>
                )}
                {isSelectedWrong && (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                    <span aria-hidden="true">✗</span> Неверно
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selected !== null && <p className="mt-3 text-xs text-[var(--text-secondary)]">{q.explanation}</p>}
      </div>

      {selected !== null && (
        <button
          type="button"
          disabled={isPending}
          onClick={next}
          className="focus-ring self-start rounded-full bg-black px-5 py-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {isPending ? "…" : index + 1 >= questions.length ? "Завершить" : "Далее"}
        </button>
      )}
    </div>
  );
}
