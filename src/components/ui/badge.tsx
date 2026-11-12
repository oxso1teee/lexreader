import type { ComponentProps } from "react";
import { cx } from "@/lib/ui/cx";

// Метка статуса. Цвет = смысл: leaf — успех/освоено, sky — память/инфо,
// ember — срочное/стрик, sun — награда, danger — ошибка; ink — ИИ/planned
// («Скоро»); plus — тариф Plus; count — счётчик на красном. Текст бейджа
// обязателен — цвет сам по себе смысла не несёт (WCAG 1.4.1).
export type BadgeTone = "neutral" | "leaf" | "sky" | "ember" | "sun" | "danger" | "solid" | "ink" | "plus" | "count";

export function Badge({
  tone = "neutral",
  className,
  ...props
}: { tone?: BadgeTone } & ComponentProps<"span">) {
  return <span className={cx("badge", tone !== "neutral" && `badge-${tone}`, className)} {...props} />;
}
