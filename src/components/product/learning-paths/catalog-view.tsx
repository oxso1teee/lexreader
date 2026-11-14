import type { ReactNode } from "react";
import type { CatalogEntry } from "@/app/(app)/learning-paths/actions";
import { Card } from "@/components/ui/card";
import type { PathRecommendation } from "@/lib/learning-paths/recommendation";
import PathCard from "./path-card";

// Каталог путей (макет Course-pick): рекомендация, если есть, и карточки всех
// путей с состоянием зачисления и пройденными уроками. Страница и галерея
// /dev/screens рисуют именно этот компонент.
export default function CatalogView({
  entries,
  recommendation,
  header,
  analytics,
}: {
  entries: CatalogEntry[];
  recommendation: PathRecommendation | null;
  header: ReactNode;
  analytics?: ReactNode;
}) {
  const recommendedPath = recommendation ? entries.find((entry) => entry.path.slug === recommendation.pathSlug) : null;

  return (
    <div className="lp page-content">
      {analytics}
      {header}

      {recommendation && recommendedPath && (
        <Card as="section" tone="leaf" aria-labelledby="lp-reco-title" className="flex flex-col gap-1">
          <h2 id="lp-reco-title" className="m-0 text-xs font-bold text-[var(--leaf-text)]">
            {recommendation.lowConfidence ? "Возможная рекомендация" : "Рекомендуем тебе"}
          </h2>
          <p className="m-0 text-sm font-bold">{recommendedPath.path.title}</p>
          <p className="m-0 text-xs text-[var(--text-secondary)]">{recommendation.reason}</p>
        </Card>
      )}

      <section aria-labelledby="lp-catalog-title" className="flex flex-col gap-3">
        <h2 id="lp-catalog-title" className="sr-only">
          Все пути
        </h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {entries.map(({ path, enrollment, progress }) => (
            <li key={path.slug}>
              <PathCard path={path} enrollment={enrollment} progress={progress} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
