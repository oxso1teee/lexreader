"use client";

import { useState, useTransition } from "react";
import { buildGrammarQuestionSet, GRAMMAR_RUNNER_CATEGORIES, type GrammarQuestion } from "@/lib/missions/grammar-bank";
import { categoryLabel } from "@/components/product/language-twin/badges";
import { track } from "@/lib/posthog-client";
import { completeGrammarGymSessionAction } from "./actions";

const QUESTIONS_PER_SESSION = 8;

type Stage = "pick" | "running" | "done";

// Gamified redesign — Grammar Gym: a standalone (non-Mission) practice
// mode over the SAME real question bank Missions already uses
// (buildGrammarQuestionSet is pure, no DB dependency), so this reuses the
// existing content rather than inventing a second one. Feedback pattern
// (icon + text + aria-live, never color-only) mirrors
// missions/[missionId]/grammar-runner.tsx.
export default function GrammarGymClient() {
  const [stage, setStage] = useState<Stage>("pick");
  const [category, setCategory] = useState<(typeof GRAMMAR_RUNNER_CATEGORIES)[number] | null>(null);
  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Takes the seed as an argument (computed at the onClick call site below)
  // rather than calling Date.now() in here itself -- the purity lint can
  // only prove a directly-referenced `onClick={start}` handler is safe to
  // be impure, not a function called one level down from an inline wrapper.
  function start(cat: (typeof GRAMMAR_RUNNER_CATEGORIES)[number], seed: string) {
    const set = buildGrammarQuestionSet(cat, QUESTIONS_PER_SESSION, seed);
    if (set.length === 0) return;
    setCategory(cat);
    setQuestions(set);
    setIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setStage("running");
    track("grammar_gym_started", { category: cat, question_count: set.length });
  }

  function choose(optionIndex: number) {
    if (selected !== null) return;
    setSelected(optionIndex);
    const q = questions[index];
    const correct = optionIndex === q.correctIndex;
    if (correct) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (index + 1 >= questions.length) {
      startTransition(async () => {
        const finalCorrect = correctCount;
        const result = await completeGrammarGymSessionAction(finalCorrect);
        setXpAwarded(result.xpAwarded);
        track("grammar_gym_completed", { category, correct_count: finalCorrect, total: questions.length });
        setStage("done");
      });
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
    }
  }

  if (stage === "pick") {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {GRAMMAR_RUNNER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => start(cat, `${Date.now()}`)}
            className="focus-ring rounded-2xl bg-[var(--surface)] p-4 text-left text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
          >
            {categoryLabel(cat)}
          </button>
        ))}
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-h2 font-bold">Готово!</p>
        <p className="mt-1 text-body text-[var(--text-secondary)]">
          {correctCount} из {questions.length} правильно
        </p>
        <p className="mt-3 text-h3 font-bold text-[var(--color-gold-text)]">+{xpAwarded} XP</p>
        <button
          type="button"
          onClick={() => setStage("pick")}
          className="focus-ring mt-4 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--color-primary-foreground)]"
        >
          Ещё раз
        </button>
      </div>
    );
  }

  const q = questions[index];
  if (!q) return null;

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${((index + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>
      <p className="text-caption text-[var(--text-secondary)]">
        {index + 1} / {questions.length}
      </p>
      <p className="mt-2 text-body font-semibold">{q.prompt}</p>

      <div className="mt-4 flex flex-col gap-2">
        {q.options.map((option, optionIndex) => {
          const isSelected = selected === optionIndex;
          const isCorrect = optionIndex === q.correctIndex;
          const showFeedback = selected !== null;
          return (
            <button
              key={optionIndex}
              type="button"
              disabled={selected !== null}
              onClick={() => choose(optionIndex)}
              className={`focus-ring flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                showFeedback && isCorrect
                  ? "border-[var(--color-success)] bg-[var(--color-success)]/10"
                  : showFeedback && isSelected
                    ? "border-[var(--color-danger)] bg-[var(--color-danger)]/10"
                    : "border-[var(--border)]"
              }`}
            >
              {showFeedback && isCorrect && <span aria-hidden="true">✓</span>}
              {showFeedback && isSelected && !isCorrect && <span aria-hidden="true">✕</span>}
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="mt-4" aria-live="polite">
          <p className="text-body-sm text-[var(--text-secondary)]">{q.explanation}</p>
          <button
            type="button"
            disabled={isPending}
            onClick={next}
            className="focus-ring mt-3 w-full rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--color-primary-foreground)] disabled:opacity-60"
          >
            {index + 1 >= questions.length ? "Завершить" : "Дальше"}
          </button>
        </div>
      )}
    </div>
  );
}
