import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 7: один визуальный язык
// для всех "здесь пока пусто" экранов вместо разных подходов на каждой
// странице — иконка + тёплая формулировка вместо голого серого текста.
//
// redesign/duolingo-flat phase 2: icon был emoji-строкой (см. историю git) —
// единая иконочная система (lucide-react), как и ScreenHeader уже сделал
// раньше. Круглая forest-tint плашка вместо голого текст-эмодзи 6xl — тот
// же паттерн иконки-в-кружке, что уже используют MissionCard/StatStrip.
export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-forest-tint)]">
        <Icon aria-hidden="true" className="h-8 w-8 text-[var(--color-forest-text)]" />
      </span>
      <p className="text-lg font-bold">{title}</p>
      <p className="max-w-xs text-sm text-[var(--text-secondary)]">{body}</p>
      {action}
    </div>
  );
}
