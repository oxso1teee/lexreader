import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import type { LessonContent } from "@/lib/learning-paths/types";

// Содержимое урока: цель, объяснение, примеры, частые ошибки. Примеры в
// курсе — просто строки на английском, без перевода и разметки того, какое
// слово выделить, поэтому они показываются как есть (ничего не придумываем),
// меняется только оформление.
export default function LessonBody({ content, children }: { content: LessonContent; children?: ReactNode }) {
  return (
    <Card as="article" className="flex flex-col gap-4">
      <p className="m-0 font-display text-base font-semibold">{content.objective}</p>
      <p className="m-0 text-sm text-[var(--text-secondary)]">{content.explanation}</p>

      <section aria-labelledby="lp-examples-title" className="flex flex-col gap-2">
        <h2 id="lp-examples-title" className="lp-section-title">
          Примеры
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {content.examples.map((example, i) => (
            <li key={i} className="rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm">
              {example}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lp-mistakes-title" className="flex flex-col gap-2">
        <h2 id="lp-mistakes-title" className="lp-section-title">
          Частые ошибки
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {content.commonMistakes.map((mistake, i) => (
            <li key={i}>
              <Alert tone="warning">{mistake}</Alert>
            </li>
          ))}
        </ul>
      </section>

      {children}
    </Card>
  );
}
