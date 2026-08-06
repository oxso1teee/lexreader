"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { track } from "@/lib/posthog-client";
import { DIAGNOSTIC_QUESTIONS } from "@/lib/language-twin/diagnostic";
import { submitDiagnosticAction, type DiagnosticSubmitResult } from "../actions";

export default function DiagnosticFlow() {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => DIAGNOSTIC_QUESTIONS.map(() => null));
  const [result, setResult] = useState<DiagnosticSubmitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function answer(optionIndex: number) {
    const next = [...answers];
    next[index] = optionIndex;
    setAnswers(next);
    if (index + 1 >= DIAGNOSTIC_QUESTIONS.length) {
      startTransition(async () => {
        const res = await submitDiagnosticAction(next);
        track("diagnostic_completed", { correct: res.correct, total: res.total });
        setResult(res);
      });
    } else {
      setIndex(index + 1);
    }
  }

  function restart() {
    setStarted(true);
    setIndex(0);
    setAnswers(DIAGNOSTIC_QUESTIONS.map(() => null));
    setResult(null);
  }

  if (result) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center shadow-sm">
        <span className="text-4xl" aria-hidden="true">
          🧭
        </span>
        <p className="text-xl font-bold">
          {result.correct} из {result.total}
        </p>
        {result.levelRange && (
          <p className="text-sm text-[var(--text-secondary)]">Ориентировочный диапазон: {result.levelRange}</p>
        )}
        <p className="max-w-sm text-sm text-[var(--text-secondary)]">
          Это не точный тест на CEFR-уровень — диагностика лишь добавляет один из трёх сигналов в общую
          оценку (см. «Как это посчитано» на главном экране «Мой английский»).
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={restart}
            className="focus-ring rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black"
          >
            Пройти ещё раз
          </button>
          <Link
            href="/language-twin"
            className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            К обзору
          </Link>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center shadow-sm">
        <span className="text-4xl" aria-hidden="true">
          🧭
        </span>
        <p className="text-sm text-[var(--text-secondary)]">
          Отвечай как получится — правильный ответ не обязателен. Диагностика не выдаёт точный CEFR-уровень,
          а становится одним из свидетельств.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              track("diagnostic_started", {});
              setStarted(true);
            }}
            className="focus-ring rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black"
          >
            Начать ({DIAGNOSTIC_QUESTIONS.length} вопросов)
          </button>
          <Link
            href="/language-twin"
            className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            Позже
          </Link>
        </div>
      </div>
    );
  }

  const q = DIAGNOSTIC_QUESTIONS[index];
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--text-secondary)]">
        Вопрос {index + 1} из {DIAGNOSTIC_QUESTIONS.length}
      </p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <span
          className="block h-full rounded-full bg-caramel"
          style={{ width: `${(index / DIAGNOSTIC_QUESTIONS.length) * 100}%` }}
        />
      </div>
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium">{q.prompt}</p>
        <div className="flex flex-col gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              disabled={isPending}
              onClick={() => answer(i)}
              className="focus-ring rounded-lg border border-[var(--border-strong)] px-4 py-2.5 text-left text-sm disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <Link
        href="/language-twin"
        className="focus-ring self-start text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline"
      >
        Пропустить диагностику
      </Link>
    </div>
  );
}
