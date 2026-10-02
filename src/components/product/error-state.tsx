import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

// Структура из docs/ui/current-ui-audit.md / product spec: что случилось →
// что можно сделать → Retry → код для поддержки. Без технического жаргона
// (stack trace/provider name) — copy guideline "Не удалось обработать PDF",
// не "Unexpected provider exception".
//
// redesign/duolingo-flat phase 2: ⚠️ emoji → lucide AlertTriangle, единая
// иконочная система (см. EmptyState — тот же паттерн иконки-в-кружке).
export default function ErrorState({
  title,
  body,
  action,
  code,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  code?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center" role="alert">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-danger-text)]/15">
        <AlertTriangle aria-hidden="true" className="h-8 w-8 text-[var(--color-danger-text)]" />
      </span>
      <p className="text-h3">{title}</p>
      <p className="text-body-sm max-w-xs text-[var(--text-secondary)]">{body}</p>
      {action}
      {code && <p className="text-caption mt-2">Код: {code}</p>}
    </div>
  );
}
