import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Прогресс. value — доля 0..1 (как у существующего product/progress-bar.tsx,
// который остаётся для старых экранов). tone — смысл: leaf — обучение,
// sky — память, sun — XP, ember — стрик/срочное, danger — риск.
export type ProgressTone = "leaf" | "sky" | "sun" | "ember" | "danger";

function clamp(value: number) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

export function Progress({
  value,
  tone = "leaf",
  size = "md",
  label,
  className,
}: {
  value: number;
  tone?: ProgressTone;
  size?: "sm" | "md" | "lg";
  /** Доступное имя («Прочитано 64%»). */
  label: string;
  className?: string;
}) {
  const percent = Math.round(clamp(value) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("progress", size !== "md" && `progress-${size}`, tone !== "leaf" && `progress-${tone}`, className)}
    >
      <div className="progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  tone = "leaf",
  size = 56,
  stroke = 6,
  label,
  children,
  className,
}: {
  value: number;
  tone?: ProgressTone;
  size?: number;
  stroke?: number;
  label: string;
  /** Центр кольца (число, иконка). */
  children?: ReactNode;
  className?: string;
}) {
  const percent = Math.round(clamp(value) * 100);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("relative inline-flex shrink-0 items-center justify-center", tone !== "leaf" && `progress-${tone}`, className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle className="progress-ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle
          className="progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamp(value))}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{children}</span>}
    </div>
  );
}
