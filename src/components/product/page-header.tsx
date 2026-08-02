import type { ReactNode } from "react";

// docs/ui/current-ui-audit.md §3: существующий ScreenHeader рендерит
// заголовок как <span>, не <h1> — ни одна страница приложения не имеет
// настоящего заголовка для screen reader'ов/структуры документа. Этот
// компонент используется только в новых Today-компонентах этого слайса
// (ScreenHeader на Library/Brain/Progress/Settings не трогаем — вне
// scope, см. docs/ui/unified-ui-slice-1-plan.md).
export default function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-h1">{title}</h1>
        {description && <p className="text-body-sm mt-1 text-[var(--text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}
