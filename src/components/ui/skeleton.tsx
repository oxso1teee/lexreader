import type { CSSProperties } from "react";
import { cx } from "@/lib/ui/cx";

// Скелетон повторяет форму будущего контента (а не «четыре серых полосы») и
// скрыт от скринридеров; смысл «идёт загрузка» несёт контейнер с
// role="status" (см. LoadingState). Анимация отключается глобальным
// prefers-reduced-motion в tokens.css.
export function Skeleton({
  className,
  width,
  height,
  circle = false,
  style,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  circle?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx("skeleton", className)}
      style={{ width, height: height ?? (circle ? width : "1rem"), borderRadius: circle ? "50%" : undefined, ...style }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="0.875rem" width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </span>
  );
}

// Спиннер: декоративный. Если он единственный индикатор — передай label.
export function Spinner({ size = "md", label, className }: { size?: "sm" | "md"; label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex", className)} role={label ? "status" : undefined}>
      <span aria-hidden="true" className={cx("spinner", size === "sm" && "spinner-sm")} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
