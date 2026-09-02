"use client";

import { useEffect, useState, useTransition } from "react";
import { categoryLabel } from "@/components/product/language-twin/badges";
import type { PatternCategory } from "@/lib/language-twin/types";
import type { PlacementResult, SelfReportedCefr } from "@/lib/placement/types";
import type { PathRecommendationV2 } from "@/lib/learning-paths/recommendation";
import type { PathSlug } from "@/lib/learning-paths/types";
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
          <p className="text-sm font-medium text-black/50 dark:text-white/50">Твой стартовый диапазон</p>
          <p className="text-4xl font-bold tracking-tight text-forest">{result.range}</p>

          {hasConflict && selfReportedCefr && selfReportedCefr !== "unsure" && (
            <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-sm text-black/70 dark:border-white/15 dark:bg-white/[0.04] dark:text-white/70">
              Несколько базовых навыков пока нестабильны. Перед более сложными темами стоит немного укрепить фундамент.
            </div>
          )}

          {(result.strongCategories.length > 0 || result.weakCategories.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {result.strongCategories.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Уже получается</p>
                  <ul className="flex flex-col gap-1 text-sm">
                    {result.strongCategories.slice(0, 3).map((c) => (
                      <li key={c}>{categoryLabel(c as PatternCategory)}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.weakCategories.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Стоит укрепить</p>
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
          <p className="text-sm font-medium text-black/50 dark:text-white/50">Предварительная рекомендация</p>
          <p className="text-lg">
            Диагностику ты пропустил(а) — рекомендация ниже основана на твоей цели и само-оценке. Пройти диагностику
            можно в любой момент позже.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <p className="text-sm font-medium text-black/50 dark:text-white/50">Рекомендуемый путь</p>
        <div className="rounded-2xl border border-forest bg-forest/10 px-4 py-4">
          <p className="text-lg font-semibold">{primary.title}</p>
          <p className="text-sm text-black/50 dark:text-white/50">{primary.kind}</p>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => choose(recommendation.primary)}
            className="focus-ring mt-3 w-full rounded-full bg-forest px-5 py-3 font-medium text-white transition-colors hover:bg-forest/90 disabled:opacity-50"
          >
            {pending === recommendation.primary ? "…" : `Выбрать «${primary.title}»`}
          </button>
        </div>

        {alternative && !showAlternative && (
          <button
            type="button"
            onClick={() => setShowAlternative(true)}
            className="focus-ring self-start text-sm text-black/50 underline underline-offset-2 dark:text-white/50"
          >
            Смотреть альтернативу: {alternative.title}
          </button>
        )}

        {alternative && showAlternative && (
          <div className="rounded-2xl border border-black/10 px-4 py-4 dark:border-white/15">
            <p className="text-lg font-semibold">{alternative.title}</p>
            <p className="text-sm text-black/50 dark:text-white/50">{alternative.kind}</p>
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => choose(recommendation.alternative as PathSlug)}
              className="focus-ring mt-3 w-full rounded-full border border-forest px-5 py-3 font-medium text-forest transition-colors hover:bg-forest/5 disabled:opacity-50"
            >
              {pending === recommendation.alternative ? "…" : `Выбрать «${alternative.title}»`}
            </button>
          </div>
        )}

        <p className="text-xs text-black/40 dark:text-white/40">
          Активным может быть только один путь одновременно — другой всегда можно начать позже, прогресс первого
          сохранится.
        </p>
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
