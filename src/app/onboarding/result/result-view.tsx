"use client";

import { useEffect, useState, useTransition } from "react";
import { categoryLabel } from "@/components/product/language-twin/badges";
import type { PatternCategory } from "@/lib/language-twin/types";
import type { PlacementResult, SelfReportedCefr } from "@/lib/placement/types";
import type { PathRecommendationV2 } from "@/lib/learning-paths/recommendation";
import type { PathSlug } from "@/lib/learning-paths/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { confirmPathAction } from "./actions";
import { track } from "@/lib/posthog-client";

const PATH_META: Record<PathSlug, { title: string; kind: string }> = {
  "a2-b1": { title: "A2 → B1", kind: "Фундамент грамматики" },
  "b1-b2": { title: "B1 → B2", kind: "Фундамент грамматики" },
  everyday: { title: "Everyday English", kind: "Тематический курс" },
  "it-english": { title: "English for IT", kind: "Тематический курс" },
};

export default function ResultView({
  isSkipped,
  result,
  recommendation,
  hasConflict,
  selfReportedCefr,
}: {
  isSkipped: boolean;
  result: PlacementResult | null;
  recommendation: PathRecommendationV2;
  hasConflict: boolean;
  selfReportedCefr: SelfReportedCefr | null;
}) {
  const [showAlternative, setShowAlternative] = useState(false);
  const [pending, setPending] = useState<PathSlug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    track("recommended_path_viewed", { path_slug: recommendation.primary, has_alternative: recommendation.alternative !== null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(pathSlug: PathSlug) {
    setError(null);
    setPending(pathSlug);
    startTransition(async () => {
      try {
        await confirmPathAction(pathSlug);
      } catch {
        setError("Не удалось начать путь. Попробуй ещё раз.");
        setPending(null);
      }
    });
  }

  const primary = PATH_META[recommendation.primary];
  const alternative = recommendation.alternative ? PATH_META[recommendation.alternative] : null;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-10">
      {!isSkipped && result ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Твой стартовый диапазон</p>
          {/* forest-text-contrast-fix: text-forest -> --color-forest-text
              (see progress/stat-card.tsx for the full contrast rationale). */}
          <p className="text-4xl font-bold tracking-tight text-[var(--color-forest-text)]">{result.range}</p>

          {hasConflict && selfReportedCefr && selfReportedCefr !== "unsure" && (
            <Card className="px-4 py-3 text-sm text-[var(--text-secondary)]">
              Несколько базовых навыков пока нестабильны. Перед более сложными темами стоит немного укрепить фундамент.
            </Card>
          )}

          {(result.strongCategories.length > 0 || result.weakCategories.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {result.strongCategories.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Уже получается</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {result.strongCategories.slice(0, 3).map((c) => (
                      <li key={c}>{categoryLabel(c as PatternCategory)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.weakCategories.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Стоит укрепить</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {result.weakCategories.slice(0, 3).map((c) => (
                      <li key={c}>{categoryLabel(c as PatternCategory)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-2">
          <p className="text-sm font-medium text-[var(--text-secondary)]">Предварительная рекомендация</p>
          <p className="text-lg">
            Диагностику ты пропустил(а) — рекомендация ниже основана на твоей цели и само-оценке. Пройти диагностику
            можно в любой момент позже.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Рекомендуемый путь</p>
        <div className="rounded-2xl border border-forest bg-forest/10 px-4 py-4">
          <p className="text-lg font-semibold">{primary.title}</p>
          <p className="text-sm text-[var(--text-secondary)]">{primary.kind}</p>
          <Button variant="leaf" disabled={pending !== null} onClick={() => choose(recommendation.primary)} className="mt-3 w-full">
            {pending === recommendation.primary ? "…" : `Выбрать «${primary.title}»`}
          </Button>
        </div>

        {alternative && !showAlternative && (
          <button
            type="button"
            onClick={() => setShowAlternative(true)}
            className="focus-ring self-start text-sm text-[var(--text-secondary)] underline underline-offset-2"
          >
            Смотреть альтернативу: {alternative.title}
          </button>
        )}

        {alternative && showAlternative && (
          <Card className="px-4 py-4">
            <p className="text-lg font-semibold">{alternative.title}</p>
            <p className="text-sm text-[var(--text-secondary)]">{alternative.kind}</p>
            <Button
              variant="ghost"
              disabled={pending !== null}
              onClick={() => choose(recommendation.alternative as PathSlug)}
              /* forest-text-contrast-fix: text-forest measured ~1.9:1 in dark;
                 --color-forest-text on the ghost fill clears AA (5.74:1 light,
                 9.86:1 dark). Only the label is forest-tinted — ghost has no border. */
              className="mt-3 w-full text-[var(--color-forest-text)]"
            >
              {pending === recommendation.alternative ? "…" : `Выбрать «${alternative.title}»`}
            </Button>
          </Card>
        )}

        <p className="text-xs text-[var(--text-secondary)]">
          Активным может быть только один путь одновременно — другой всегда можно начать позже, прогресс первого
          сохранится.
        </p>
      </section>

      {error && (
        <p role="alert" className="text-sm text-[var(--color-danger-text)]">
          {error}
        </p>
      )}
    </div>
  );
}
