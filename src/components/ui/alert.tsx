import { AlertTriangle, CheckCircle2, Info, Sparkles, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Встроенное сообщение внутри страницы (в отличие от Toast, который
// эфемерен и вне потока). Для важных ошибок формы — live="assertive":
// скринридер прочитает сразу; для остальных live не включаем, чтобы статичные
// баннеры не озвучивались при каждом рендере.
export type AlertTone = "info" | "success" | "warning" | "error" | "ai";

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  ai: Sparkles,
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  action,
  live,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  live?: "polite" | "assertive";
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={cx("alert", `alert-${tone}`, className)}
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
    >
      <Icon aria-hidden="true" className="alert-icon" />
      <div className="min-w-0 flex-1">
        {title && <span className="alert-title">{title}</span>}
        {children}
      </div>
      {action}
    </div>
  );
}
