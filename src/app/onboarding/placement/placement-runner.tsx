"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AuthBody, AuthDock } from "@/components/product/auth/auth-screen";
import { categoryLabel } from "@/components/product/language-twin/badges";
import { Lex } from "@/components/product/mascot/lex";
import { LexSay, StepFrame, StepShell } from "@/components/product/onboarding/step-shell";
import { Alert, Button, Card, ChoiceGroup } from "@/components/ui";
import type { PatternCategory } from "@/lib/language-twin/types";
import { splitAtGap } from "@/lib/placement/prompt-gap";
import { pluralRu } from "@/lib/plural-ru";
import { cx } from "@/lib/ui/cx";
import { startPlacementAction, submitPlacementAnswerAction, skipPlacementAction } from "./actions";

export interface PublicPlacementQuestion {
  id: string;
  tier: "foundational" | "intermediate" | "upper";
  category: string;
  prompt: string;
  options: string[];
}

// Тест уровня в макетах Placement-question: полоса прогресса «Вопрос N из M»,
// Lex с подсказкой, предложение с пропуском-плиткой, пронумерованные варианты
// (цифры 1…N работают как клавиши, пока фокус в группе), «Далее» в доке.
//
// Намеренно НЕ перенесено из макета: «уровень B1» в подписи (уровень вопроса —
// это подсказка о сложности, её прятали и раньше), «вопросы подстраиваются под
// тебя» (тест не адаптивный — фиксированный список) и кнопка «Не знаю» (в
// ответах такого варианта нет, и scoring его не знает).

function GapSentence({ before, after, answer }: { before: string; after: string; answer: string | null }) {
  return (
    <p lang="en" className="text-[1.125rem] leading-[1.9] [font-family:var(--font-reading,Georgia,serif)]">
      {before}
      <span
        role={answer ? undefined : "img"}
        aria-label={answer ? undefined : "пропуск"}
        className={cx(
          "mx-0.5 inline-flex min-h-[2.125rem] min-w-[5.25rem] items-center justify-center rounded-xl border-2 border-[var(--sky)] bg-[var(--sky-tint)] px-3 align-middle font-sans",
          answer ? "text-[1rem] font-semibold" : "border-dashed",
        )}
      >
        {answer ?? " "}
      </span>
      {after}
    </p>
  );
}

const SECONDARY_ACTION =
  "min-h-11 text-sm font-bold text-[var(--text-secondary)] underline underline-offset-2 hover:text-[var(--foreground)] disabled:opacity-50";

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
      <StepFrame>
        <main className="flex flex-1 flex-col md:flex-none">
          <AuthBody className="items-center justify-center pt-8 text-center">
            <Lex mood="think" size={88} bob />
            <h1 className="font-display text-[1.625rem] leading-tight font-bold">Короткая проверка уровня</h1>
            <p className="text-[0.9375rem] text-[var(--text-secondary)]">
              {questions.length} {pluralRu(questions.length, "короткий вопрос", "коротких вопроса", "коротких вопросов")} ·
              около 3 минут. Это не официальный экзамен — просто поможет точнее подобрать курс. Отвечай как чувствуешь,
              без подсказок.
            </p>
            <Card tone="sunken" className="flex items-start gap-3 text-left text-sm">
              <Info aria-hidden="true" className="mt-px h-[18px] w-[18px] flex-none text-[var(--sky-text)]" />
              <p>
                Во время теста не показываем «верно/неверно» по каждому вопросу — результат увидишь в конце, целиком.
              </p>
            </Card>
            {error && (
              <Alert tone="error" live="assertive" className="w-full text-left">
                {error}
              </Alert>
            )}
          </AuthBody>
          <AuthDock>
            <Button block loading={isPending} onClick={begin}>
              {isRetake ? "Обновить диагностику" : "Начать проверку"}
            </Button>
            {isRetake ? (
              <button type="button" onClick={() => router.push("/language-twin")} className={SECONDARY_ACTION}>
                Отмена
              </button>
            ) : (
              <button type="button" disabled={isPending} onClick={skip} className={SECONDARY_ACTION}>
                Пропустить диагностику
              </button>
            )}
          </AuthDock>
        </main>
      </StepFrame>
    );
  }

  const q = questions[index];
  if (!q) {
    // Defensive — shouldn't happen (submit redirects once index reaches
    // questions.length), but never render a crash for a stale index.
    router.push(isRetake ? "/language-twin" : "/onboarding/result");
    return null;
  }

  const gap = splitAtGap(q.prompt);
  const instruction = gap ? "Какой вариант подходит?" : q.prompt;
  const answer = selected === null ? null : (q.options[selected] ?? null);
  const isLast = index + 1 >= questions.length;

  return (
    <StepShell
      step={index + 1}
      total={questions.length}
      tone="sky"
      label={`Вопрос ${index + 1} из ${questions.length}`}
    >
      <AuthBody>
        <LexSay mood="think">
          Отвечай как чувствуешь — это не экзамен. «Верно/неверно» не показываем: результат увидишь в конце, целиком.
        </LexSay>

        <div>
          {/* aria-live: при смене вопроса скринридер объявляет номер и тему
              (раньше это делала отдельная строка «Вопрос N из M»). */}
          <p
            aria-live="polite"
            className="text-[0.71875rem] font-bold uppercase tracking-[0.08em] text-[var(--text-tertiary)]"
          >
            <span className="sr-only">
              Вопрос {index + 1} из {questions.length}.{" "}
            </span>
            Грамматика · {categoryLabel(q.category as PatternCategory)}
          </p>
          <h1 className="mt-1.5 font-display text-[1.375rem] leading-tight font-bold">{instruction}</h1>
        </div>

        {gap && (
          <Card as="section" aria-label="Предложение" className="px-4 py-[1.125rem]">
            <GapSentence before={gap.before} after={gap.after} answer={answer} />
          </Card>
        )}

        <ChoiceGroup
          legend={instruction}
          name="placement-answer"
          numbered
          value={selected === null ? "" : String(selected)}
          onValueChange={(value) => setSelected(Number(value))}
          options={q.options.map((option, i) => ({ value: String(i), label: option, disabled: isPending }))}
        />

        {error && (
          <Alert tone="error" live="assertive">
            {error}
          </Alert>
        )}
      </AuthBody>

      <AuthDock>
        <Button block disabled={selected === null} loading={isPending} onClick={submit}>
          {isLast ? "Завершить" : "Далее"}
        </Button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => (isRetake ? router.push("/language-twin") : skip())}
          className={SECONDARY_ACTION}
        >
          {isRetake ? "Отмена" : "Пропустить диагностику"}
        </button>
      </AuthDock>
    </StepShell>
  );
}
