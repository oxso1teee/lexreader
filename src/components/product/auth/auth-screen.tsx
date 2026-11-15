import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton, IconButtonLink } from "@/components/ui";
import { cx } from "@/lib/ui/cx";

// Каркас экранов входа и восстановления доступа (Login, Signup,
// Magic-link-sent, Reset-password…). Вне app-shell: пользователь ещё не
// вошёл, навигации нет. Колонка одна на всех ширинах — для этих экранов в
// макетах нет desktop-композиции: 28rem по центру, шапка с «назад» и
// заголовком, ниже <main> с телом и закреплённым «доком» главного действия.
// На md+ блок центрируется по вертикали, а док перестаёт «прилипать» к низу
// окна — иначе кнопка оказывается далеко от полей.
//
// Пример:
//   <AuthScreen title="Вход" backHref="/onboarding">
//     <form className="flex flex-1 flex-col md:flex-none">
//       <AuthBody>…поля…</AuthBody>
//       <AuthDock>…кнопка…</AuthDock>
//     </form>
//   </AuthScreen>
export function AuthScreen({
  title,
  subtitle,
  backHref,
  onBack,
  backLabel = "Назад",
  backIcon = <ArrowLeft className="h-6 w-6" />,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Ссылка «назад» (страница) — либо onBack для переключения состояния внутри экрана. */
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  /** Стрелка «назад» по умолчанию; для «закрыть» — крестик. */
  backIcon?: ReactNode;
  children: ReactNode;
}) {
  const icon = backIcon;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col md:justify-center md:py-8">
      <header className="flex flex-none items-center gap-1 px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
        {onBack ? (
          <IconButton label={backLabel} icon={icon} onClick={onBack} />
        ) : backHref ? (
          <IconButtonLink href={backHref} label={backLabel} icon={icon} />
        ) : (
          <span aria-hidden="true" className="w-11 flex-none" />
        )}
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-base font-bold leading-tight">{title}</p>
          {subtitle && <p className="text-xs font-medium text-[var(--text-secondary)]">{subtitle}</p>}
        </div>
        <span aria-hidden="true" className="w-11 flex-none" />
      </header>
      <main className="flex flex-1 flex-col md:flex-none">{children}</main>
    </div>
  );
}

export function AuthBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("flex flex-1 flex-col gap-3.5 px-4 pb-6 pt-1 md:flex-none", className)}>{children}</div>;
}

// Док главного действия (в макетах — нижняя панель у большого пальца).
export function AuthDock({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "sticky bottom-0 flex flex-col gap-2.5 bg-[var(--background)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 md:static md:pb-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
