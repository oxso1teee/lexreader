import { Skeleton } from "@/components/ui/skeleton";

// Suspense-fallback маршрута /home: повторяет форму нового экрана «Сегодня»
// (пилюли, приветствие, hero, две плитки, неделя, продолжение), чтобы
// контент не прыгал при появлении. Те же контейнерные классы .dash-*, поэтому
// на широком экране скелетон тоже встаёт в две колонки. Смысл «идёт
// загрузка» несёт контейнер (role="status"); сами полоски скрыты от
// скринридеров, анимацию гасит глобальный prefers-reduced-motion.
export default function HomeLoading() {
  return (
    <div className="dash page-wide" role="status" aria-busy="true" aria-label="Загружаем главный экран">
      <div className="dash-top">
        <div className="dash-pills">
          <Skeleton width={96} height={44} className="!rounded-full" />
          <div className="dash-pills-end">
            <Skeleton width={64} height={44} className="!rounded-full" />
            <Skeleton width={84} height={44} className="!rounded-full" />
            <Skeleton width={44} height={44} circle />
          </div>
        </div>
        <div className="dash-greet">
          <Skeleton width={56} height={66} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton width="60%" height={24} />
            <Skeleton width="40%" height={14} />
          </div>
        </div>
      </div>

      <div className="dash-cols">
        <div className="dash-main">
          <div className="order-1">
            <Skeleton height={196} className="!rounded-3xl" />
          </div>
          <div className="dash-tiles order-2">
            <Skeleton height={84} className="!rounded-[20px]" />
            <Skeleton height={84} className="!rounded-[20px]" />
          </div>
          <div className="order-5">
            <Skeleton height={96} className="!rounded-[20px]" />
          </div>
        </div>
        <div className="dash-aside">
          <div className="order-4">
            <Skeleton height={132} className="!rounded-[20px]" />
          </div>
        </div>
      </div>
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}
