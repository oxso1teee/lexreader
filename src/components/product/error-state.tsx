import type { ReactNode } from "react";

// Структура из docs/ui/current-ui-audit.md / product spec: что случилось →
// что можно сделать → Retry → код для поддержки. Без технического жаргона
// (stack trace/provider name) — copy guideline "Не удалось обработать PDF",
// не "Unexpected provider exception".
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
      <span className="text-4xl" aria-hidden="true">
        ⚠️
      </span>
      <p className="text-h3">{title}</p>
      <p className="text-body-sm max-w-xs text-[var(--text-secondary)]">{body}</p>
      {action}
      {code && <p className="text-caption mt-2">Код: {code}</p>}
    </div>
  );
}
