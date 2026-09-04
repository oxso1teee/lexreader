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

// Placement question mockup alignment — the tier badge that used to render
// here (Базовый/Средний/Продвинутый) is gone from the question screen (not
// in the reference, and the eyebrow's question-number already places you),
// so this label lookup has no remaining call site.

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
        <div className="rounded-2xl border border-black/10 px-4 py-3 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
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
            className="focus-ring rounded-full bg-forest px-5 py-3 font-medium text-white transition-colors hover:bg-forest/90 disabled:opacity-50"
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
      {/* Placement question mockup alignment — progress pills (left) and
          Skip/Cancel (right) combined into one row; the tier badge
          (TIER_LABEL) is dropped, not present in the reference and the
          question number below already identifies where we are. */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <span
              key={i}
              className={`h-[3px] w-[13px] rounded-full ${i <= index ? "bg-[var(--color-forest-light)]" : "bg-[var(--border)]"}`}
            />
          ))}
        </div>
        <button
          type="button"
          disabled={isPending}
          onClick={() => (isRetake ? router.push("/language-twin") : skip())}
          className="focus-ring text-[10.5px] text-[var(--text-secondary)] underline underline-offset-2 disabled:opacity-50"
        >
          {isRetake ? "Отмена" : "Пропустить"}
        </button>
      </div>

      {/* Replaces the old standalone "Вопрос N из M" line -- same real
          numbers, just folded into one eyebrow above the question.
          aria-live carried over from that line so screen readers still get
          an announcement each time the index changes. */}
      <p className="mb-4 font-mono text-[10.5px] text-[var(--text-secondary)]" aria-live="polite">
        Короткая проверка уровня · вопрос {index + 1} из {questions.length}
      </p>

      <h2 className="mb-4 text-[15.5px] font-bold leading-snug">{q.prompt}</h2>

      <div className="flex flex-col gap-2">
        {q.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={isPending}
            onClick={() => setSelected(i)}
            className={`rounded-2xl border px-4 py-3 text-left text-[13px] transition-colors disabled:opacity-60 ${
              selected === i
                ? "border-forest bg-forest/15 text-[var(--color-forest-text)]"
                : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <p className="mt-3 text-center text-[10.5px] text-[var(--text-secondary)]">
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
          className="focus-ring w-full rounded-full bg-forest px-5 py-3 font-medium text-white transition-colors hover:bg-forest/90 disabled:opacity-40"
        >
          {isPending ? "…" : index + 1 >= questions.length ? "Завершить" : "Далее"}
        </button>
      </div>
    </div>
  );
}
