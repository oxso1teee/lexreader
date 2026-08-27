import PathCard from "@/components/product/learning-paths/path-card";
import LearningPathsSubHeader from "./sub-header";
import LearningPathsViewTracker from "./analytics";
import { getCatalogAction } from "./actions";

// M3 Slice 8 — Path Catalog (plan doc's screen A). No new bottom-nav item —
// reached from a Library entry / Today card, same precedent as
// /missions and /language-twin (audit finding: /library already owns
// "Учиться").
export default async function LearningPathsCatalogPage() {
  const { entries, recommendation } = await getCatalogAction();
  const recommendedPath = recommendation ? entries.find((e) => e.path.slug === recommendation.pathSlug) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LearningPathsViewTracker event="learning_paths_viewed" />
      <LearningPathsSubHeader
        title="Пути обучения"
        description="Структурированные курсы поверх твоего профиля «Мой английский» — грамматика по порядку, а не случайные упражнения."
        backHref="/library"
        backLabel="К библиотеке"
      />

      {recommendation && recommendedPath && (
        <div className="flex flex-col gap-1 rounded-2xl border border-[var(--color-forest-text)]/30 bg-[var(--color-forest-text)]/5 p-4">
          <span className="text-xs font-semibold text-[var(--color-forest-text)]">
            {recommendation.lowConfidence ? "Возможная рекомендация" : "Рекомендуем тебе"}
          </span>
          <p className="text-sm font-medium">{recommendedPath.path.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">{recommendation.reason}</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {entries.map(({ path, enrollment }) => (
          <PathCard key={path.slug} path={path} enrollment={enrollment} />
        ))}
      </div>
    </div>
  );
}
