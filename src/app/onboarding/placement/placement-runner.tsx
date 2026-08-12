"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPlacementAction, submitPlacementAnswerAction, skipPlacementAction } from "./actions";

export interface PublicPlacementQuestion {
  id: string;
  tier: "foundational" | "intermediate" | "upper";
  category: string;
  prompt: string;
  options: string[];
}

const TIER_LABEL: Record<PublicPlacementQuestion["tier"], string> = {
  foundational: "Базовый",
  intermediate: "Средний",
  upper: "Продвинутый",
};

export default function PlacementRunner({
  questions,
  hasStarted,
  resumeIndex,
  isRetake = false,
}: {
  questions: PublicPlacementQuestion[];
  hasStarted: boolean;
  resumeIndex: number;
  /** M3 Slice 9 §31 — reached via /onboarding/placement?retake=1 from
   *  Language Twin/Settings. The user already has an active path; skip
   *  doesn't apply here (there's nothing to skip *to*) and completion
   *  returns to Language Twin, never the path-selection screen. */
  isRetake?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"intro" | "question">(hasStarted ? "question" : "intro");
  const [index, setIndex] = useState(resumeIndex);
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function begin() {
    setError(null);
    startTransition(async () => {
      try {
        const { resumeIndex: startIndex } = await startPlacementAction();
        setIndex(startIndex);
        setPhase("question");
      } catch {
        setError("Не удалось начать диагностику. Проверь соединение и попробуй снова.");
      }
    });
  }

  function skip() {
    setError(null);
    startTransition(async () => {
      try {
        await skipPlacementAction();
        // skipPlacementAction redirects server-side; this only runs if that
        // somehow didn't happen (kept as a defensive fallback).
        router.push("/onboarding/result");
      } catch {
        setError("Не удалось пропустить диагностику. Попробуй ещё раз.");
      }
    });
  }

  function submit() {
    if (selected === null) return;
    setError(null);
    const q = questions[index];
    startTransition(async () => {
      try {
        const { nextIndex, isDone } = await submitPlacementAnswerAction(q.id, selected);
        if (isDone) {
          router.push(isRetake ? "/language-twin" : "/onboarding/result");
        } else {
          setIndex(nextIndex);
          setSelected(null);
        }
      } catch {
        // Plan doc §38: retry must not wipe progress — the answer wasn't
        // confirmed server-side, so the current selection stays as-is and
        // the same submit can just be retried.
        setError("Не удалось сохранить ответ. Твой прогресс не потерян — попробуй ещё раз.");
      }
    });
  }

  if (phase === "intro") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Короткая проверка уровня</h1>
        <p className="text-black/60 dark:text-white/60">
          10 коротких вопросов · около 3 минут. Это не официальный экзамен — просто поможет точнее подобрать курс.
          Отвечай как чувствуешь, без подсказок.
        </p>
        <div className="rounded-lg border border-black/10 px-4 py-3 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
          Во время теста не показываем «верно/неверно» по каждому вопросу — результат увидишь в конце, целиком.
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-col gap-3">
          <button
            type="button"
            disabled={isPending}
            onClick={begin}
            className="focus-ring rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {isPending ? "Начинаем…" : isRetake ? "Обновить диагностику" : "Начать проверку"}
          </button>
          {isRetake ? (
            <button
              type="button"
              onClick={() => router.push("/language-twin")}
              className="focus-ring text-sm text-black/50 underline underline-offset-2 dark:text-white/50"
            >
              Отмена
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={skip}
              className="focus-ring text-sm text-black/50 underline underline-offset-2 disabled:opacity-50 dark:text-white/50"
            >
              Пропустить диагностику
            </button>
          )}
        </div>
      </div>
    );
  }

  const q = questions[index];
  if (!q) {
    // Defensive — shouldn't happen (submit redirects once index reaches
    // questions.length), but never render a crash for a stale index.
    router.push(isRetake ? "/language-twin" : "/onboarding/result");
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          {TIER_LABEL[q.tier]}
        </span>
        <button
          type="button"
          disabled={isPending}
          onClick={() => (isRetake ? router.push("/language-twin") : skip())}
          className="focus-ring text-xs text-black/40 underline underline-offset-2 disabled:opacity-50 dark:text-white/40"
        >
          {isRetake ? "Отмена" : "Пропустить"}
        </button>
      </div>

      <p className="mb-1 text-sm text-black/50 dark:text-white/50" aria-live="polite">
        Вопрос {index + 1} из {questions.length}
      </p>
      <div className="mb-6 flex gap-1.5">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= index ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/15"}`}
          />
        ))}
      </div>

      <h2 className="mb-4 text-xl font-semibold">{q.prompt}</h2>

      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={isPending}
            onClick={() => setSelected(i)}
            className={`rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-60 ${
              selected === i
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-black/40 dark:text-white/40">
        Без подсказок «верно/неверно» — так результат честнее. Увидишь его целиком на следующем экране.
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-6">
        <button
          type="button"
          disabled={selected === null || isPending}
          onClick={submit}
          className="focus-ring w-full rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          {isPending ? "…" : index + 1 >= questions.length ? "Завершить" : "Далее"}
        </button>
      </div>
    </div>
  );
}
