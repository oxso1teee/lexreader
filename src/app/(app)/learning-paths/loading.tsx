import { Skeleton } from "@/components/ui/skeleton";

// Фоллбэк маршрутов /learning-paths/** (каталог, карта, раздел, урок): форма
// у них общая — шапка, крупный блок (hero) и список карточек. Полосы скрыты от
// скринридеров, «идёт загрузка» произносит контейнер (role="status").
// prefers-reduced-motion обрабатывается глобально в tokens.css.
export default function LearningPathsLoading() {
  return (
    <div role="status" aria-busy="true" className="lp page-content">
      <span className="sr-only">Загрузка</span>
      <div className="flex flex-col gap-2">
        <Skeleton height="0.75rem" width="5rem" />
        <Skeleton height="2rem" width="65%" />
      </div>
      <Skeleton height="11rem" className="rounded-[24px]" />
      <Skeleton height="0.75rem" width="4.5rem" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} height="6.5rem" className="rounded-[var(--radius-card)]" />
        ))}
      </div>
    </div>
  );
}
