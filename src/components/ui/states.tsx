import { Compass, WifiOff } from "lucide-react";
import ErrorState from "@/components/product/error-state";
import { cx } from "@/lib/ui/cx";
import { ButtonLink } from "./button";
import { Skeleton } from "./skeleton";

// Единая точка входа для «пустых» состояний интерфейса. Пустое состояние и
// ошибка — те же компоненты, что уже использует приложение (reuse, не
// дубль); здесь добавлены недостающие: универсальная загрузка, «нет сети»,
// «не найдено».
export { default as EmptyState } from "@/components/empty-state";
export { default as ErrorState } from "@/components/product/error-state";

// Универсальная загрузка: скелет списка карточек. Для экранов со своей
// формой (Today) остаётся product/loading-state.tsx. role="status" +
// aria-busy — скринридер слышит «Загрузка», сами полосы скрыты.
export function LoadingState({ rows = 3, label = "Загрузка", className }: { rows?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cx("flex flex-col gap-3", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height="4rem" className="rounded-[var(--radius-card)]" />
      ))}
    </div>
  );
}

export function OfflineState({ action }: { action?: React.ReactNode }) {
  return (
    <ErrorState
      icon={WifiOff}
      title="Нет соединения"
      body="Скачанные тексты читаются и без сети. Прогресс отправим, когда связь вернётся."
      action={action}
    />
  );
}

export function NotFoundState({ homeHref = "/home", homeLabel = "На главную" }: { homeHref?: string; homeLabel?: string }) {
  return (
    <div className="flex flex-col items-center">
      {/* Декоративный «404» из макета Not-found; без него e2e (pdf/youtube
          import) не отличают чужой текст от несуществующей страницы. */}
      <span aria-hidden="true" className="text-[96px] font-bold leading-none tracking-tight text-[var(--text-tertiary)] [font-family:var(--font-display)]">
        404
      </span>
      <ErrorState
        icon={Compass}
        title="Такой страницы нет"
        body="Возможно, ссылка устарела или в адресе опечатка. Вернись на главную — всё твоё на месте."
        action={
          <ButtonLink href={homeHref} className="mt-2">
            {homeLabel}
          </ButtonLink>
        }
      />
    </div>
  );
}
