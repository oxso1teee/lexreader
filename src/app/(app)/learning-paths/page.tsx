import { redirect } from "next/navigation";
import CatalogView from "@/components/product/learning-paths/catalog-view";
import { pathHref } from "@/lib/learning-paths/routes";
import LearningPathsSubHeader from "./sub-header";
import LearningPathsViewTracker from "./analytics";
import { getCatalogAction } from "./actions";

// M3 Slice 8 — Path Catalog (plan doc's screen A).
// Нижняя вкладка «Учиться» ведёт сюда: при активном пути сразу открываем его
// карту ([pathSlug]/page.tsx), каталог остаётся для выбора пути. Чтобы сменить
// путь, не ставя активный на паузу, карта ссылается сюда с ?all=1 — тогда
// каталог показывается и при активном пути.
export default async function LearningPathsCatalogPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const { all } = await searchParams;
  const { entries, recommendation } = await getCatalogAction();
  const active = entries.find((entry) => entry.enrollment?.status === "active") ?? null;
  if (active && all !== "1") redirect(pathHref(active.path.slug));

  return (
    <CatalogView
      entries={entries}
      recommendation={recommendation}
      analytics={<LearningPathsViewTracker event="learning_paths_viewed" />}
      header={
        <LearningPathsSubHeader
          title="Пути обучения"
          description="Структурированные курсы поверх твоего профиля «Мой английский» — грамматика по порядку, а не случайные упражнения."
          backHref={active ? pathHref(active.path.slug) : "/library"}
          backLabel={active ? "К моему пути" : "К библиотеке"}
        />
      }
    />
  );
}
