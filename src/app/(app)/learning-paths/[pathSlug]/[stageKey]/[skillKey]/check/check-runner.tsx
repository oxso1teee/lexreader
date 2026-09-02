"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { submitKnowledgeCheckAction, type KnowledgeCheckSubmitResult } from "../../../../actions";
import { track } from "@/lib/posthog-client";
import type { GrammarQuestion } from "@/lib/missions/grammar-bank";
import type { PathSlug } from "@/lib/learning-paths/types";

// Deterministic multiple-choice check, scored server-side only (plan doc:
// "never trust a client-computed score/bucket") — mirrors
// missions/[missionId]/grammar-runner.tsx's feedback pattern (icon + text +
// aria-live, never color-only), but state stays local to this component:
// Knowledge Check has no cross-device resume requirement, unlike Missions.
export default function CheckRunner({
  pathSlug,
  skillKey,
  questions,
}: {
  pathSlug: PathSlug;
  skillKey: string;
  questions: GrammarQuestion[];
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [result, setResult] = useState<KnowledgeCheckSubmitResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const q = questions[index];

  if (result) {
    return <ResultScreen pathSlug={pathSlug} result={result} onRefresh={() => router.refresh()} />;
  }

  function choose(optionIndex: number) {
    if (selected !== null || isPending) return;
    setSelected(optionIndex);
    if (optionIndex === q.correctIndex) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      const finalCorrect = correctCount;
      startTransition(async () => {
        const submitted = await submitKnowledgeCheckAction(pathSlug, skillKey, finalCorrect, questions.length);
        track("knowledge_check_completed", { path_slug: pathSlug, skill_key: skillKey, bucket: submitted?.outcome.bucket });
        setResult(submitted);
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
        <span className="block h-full rounded-full bg-forest transition-[width]" style={{ width: `${(index / questions.length) * 100}%` }} />
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
                className={`focus-ring flex items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-left text-sm transition-colors ${stateClass}`}
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
          className="focus-ring self-start rounded-full bg-forest px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? "…" : index + 1 >= questions.length ? "Завершить" : "Далее"}
        </button>
      )}
    </div>
  );
}

const BUCKET_META: Record<string, { title: string; body: string }> = {
  strong: { title: "Отлично!", body: "Ты уверенно справляешься с этой темой — навык отмечен как «Уверенно»." },
  mixed: { title: "Неплохо, но есть над чем поработать", body: "Часть вопросов вызвала сложности — стоит потренироваться ещё." },
  weak: { title: "Пока рано закрывать тему", body: "Вернись к уроку и попробуй ещё раз, когда будешь готов(а)." },
};

function ResultScreen({
  pathSlug,
  result,
  onRefresh,
}: {
  pathSlug: PathSlug;
  result: KnowledgeCheckSubmitResult;
  onRefresh: () => void;
}) {
  const meta = BUCKET_META[result.outcome.bucket];
  const percent = Math.round(result.outcome.scoreRatio * 100);

  // M3 Slice 9 (plan doc §16/§17) — the real first-win moment, reached
  // through the exact same Knowledge Check every other skill uses. No
  // separate onboarding-only screen.
  if (result.firstWinJustCompleted) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm" role="status" aria-live="polite">
        <p className="text-lg font-bold">Отличное начало! 🎉</p>
        <p className="text-sm text-[var(--text-secondary)]">
          {meta.body} Результат: {percent}%. Твой путь сохранён — дальше Today будет каждый день показывать, что делать
          следующим.
        </p>
        <Link href="/home" onClick={onRefresh} className="focus-ring self-start rounded-full bg-forest px-4 py-2 text-sm font-medium text-white">
          Перейти в Today
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm" role="status" aria-live="polite">
      <p className="text-lg font-bold">{meta.title}</p>
      <p className="text-sm text-[var(--text-secondary)]">{meta.body}</p>
      <p className="text-sm font-medium">Результат: {percent}%</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/learning-paths/${pathSlug}`}
          onClick={onRefresh}
          className="focus-ring rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
        >
          К пути
        </Link>
        {result.outcome.bucket !== "strong" && (
          <Link href="/missions" className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium">
            Найти миссию
          </Link>
        )}
      </div>
    </div>
  );
}
