import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { FirstStep, FirstStepsState } from "@/lib/dashboard/first-steps";

function StepContent({ step, index }: { step: FirstStep; index: number }) {
  return (
    <>
      <span className="dash-step-n" aria-hidden="true">
        {step.status === "done" ? <Check className="h-4 w-4" /> : index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{step.title}</span>
        <span className="block text-xs text-[var(--text-secondary)]">{step.hint}</span>
      </span>
      {step.href && (
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--text-secondary)]" />
      )}
    </>
  );
}

// Чек-лист «Первые шаги» (макет Today-new). Состояние каждого шага выводится
// из реальных данных (см. lib/dashboard/first-steps.ts), хранить нечего.
export default function FirstStepsCard({ state }: { state: FirstStepsState }) {
  return (
    <Card as="section" aria-labelledby="dash-steps-title" className="overflow-hidden !p-0">
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <h2 id="dash-steps-title" className="m-0 text-base font-bold">
          Первые шаги
        </h2>
        <span className="text-xs font-bold text-[var(--text-secondary)]">
          {state.doneCount} из {state.total}
        </span>
      </div>
      <div className="px-4 pt-1 pb-3">
        <Progress
          value={state.doneCount / state.total}
          size="sm"
          label={`Первые шаги: ${state.doneCount} из ${state.total}`}
        />
      </div>
      <ol className="m-0 list-none p-0">
        {state.steps.map((step, index) => {
          const current = step.status === "current" ? "step" : undefined;
          return (
            <li key={step.key} className="border-t border-[var(--border)]">
              {step.href ? (
                <Link href={step.href} className="dash-step" data-status={step.status} aria-current={current}>
                  <StepContent step={step} index={index} />
                </Link>
              ) : (
                <div className="dash-step" data-status={step.status} aria-current={current}>
                  <StepContent step={step} index={index} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
