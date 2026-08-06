import type { ReactNode } from "react";

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 7: один визуальный язык
// для всех "здесь пока пусто" экранов вместо разных подходов на каждой
// странице — иконка + тёплая формулировка вместо голого серого текста.
export default function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="text-6xl">{icon}</span>
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-xs text-sm text-[var(--text-secondary)]">{body}</p>
      {action}
    </div>
  );
}
