import { PlayCircle } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LESSON_BASE_XP, LESSON_PERFECT_BONUS_XP } from "@/lib/lessons/scoring";
import type { LessonOverview } from "@/lib/lessons/server";

/** Награда за навык одна; текст говорит, чем она уже получена, и что повторное прохождение — практика. */
export function xpEarnedText(via: LessonOverview["xpEarnedVia"]): string {
  if (via === "check") return "XP за этот навык уже получен за проверку знаний — награда одна на навык, урок можно пройти как практику.";
  return "XP за этот навык уже получен за урок — повторное прохождение это практика.";
}

// Вход в плеер со страницы урока: «Начать», «Продолжить · шаг 3 из 8» или
// «Пройти ещё раз». Данные — из сохранённых попыток (getLessonOverview).
export default function LessonStartCard({ overview, playUrl, completed }: { overview: LessonOverview; playUrl: string; completed: boolean }) {
  const { open, last, xpEarned, xpEarnedVia, stepCount, exerciseCount } = overview;
  const label = open ? `Продолжить · шаг ${Math.min(open.stepIndex + 1, open.stepsTotal)} из ${open.stepsTotal}` : completed ? "Пройти ещё раз" : "Начать урок";
  const total = last ? last.correctCount + last.incorrectCount : 0;

  return (
    <Card as="section" tone={open ? "sky" : undefined} aria-labelledby="lp-play-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="lp-play-title" className="lp-section-title">
          Пройти урок
        </h2>
        <p className="m-0 text-sm">
          {stepCount} {stepCount === 1 ? "шаг" : "шагов"}
          {exerciseCount > 0 ? ` · упражнений: ${exerciseCount}` : " · без упражнений"}. Прогресс сохраняется после каждого шага.
        </p>
        {last && total > 0 && (
          <p className="m-0 text-xs text-[var(--text-secondary)]">
            Последний результат: {last.correctCount} из {total} верно.
          </p>
        )}
        <p className="m-0 text-xs text-[var(--text-secondary)]">
          {xpEarned ? xpEarnedText(xpEarnedVia) : `За прохождение: +${LESSON_BASE_XP} XP, +${LESSON_PERFECT_BONUS_XP} за урок без ошибок. Награда за навык одна — её можно получить за урок или за проверку знаний.`}
        </p>
      </div>
      <ButtonLink href={playUrl} className="self-start">
        <PlayCircle aria-hidden="true" className="h-5 w-5" /> {label}
      </ButtonLink>
    </Card>
  );
}

/** Вместо кнопки «Отметить как изученное» у уроков с упражнениями: их нельзя засчитать одним кликом. */
export function ExercisesRequiredNote() {
  return (
    <p className="m-0 text-sm text-[var(--text-secondary)]">
      Этот урок засчитывается после упражнений: нажми «Начать урок» выше или пройди быструю проверку.
    </p>
  );
}
