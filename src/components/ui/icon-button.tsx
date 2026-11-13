import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Кнопка-иконка: подпись (label) обязательна — это aria-label; без неё
// компонент не компилируется. Зона нажатия 44×44 (size="sm" визуально 36,
// но расширяет зону через ::after).
export type IconButtonVariant = "plain" | "boxed" | "solid";

interface IconButtonStyleProps {
  /** Доступное имя действия: «Закрыть», «Назад», «Меню». */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: "md" | "sm";
}

export function iconButtonClassName({
  variant = "plain",
  size = "md",
  className,
}: { variant?: IconButtonVariant; size?: "md" | "sm"; className?: string } = {}) {
  return cx(
    "icon-btn",
    variant === "boxed" && "icon-btn-boxed",
    variant === "solid" && "icon-btn-solid",
    size === "sm" && "icon-btn-sm",
    className,
  );
}

export function IconButton({
  label,
  icon,
  variant,
  size,
  className,
  type = "button",
  ...props
}: IconButtonStyleProps & Omit<ComponentProps<"button">, "aria-label" | "children">) {
  return (
    <button type={type} aria-label={label} className={iconButtonClassName({ variant, size, className })} {...props}>
      <span aria-hidden="true" className="flex">
        {icon}
      </span>
    </button>
  );
}

export function IconButtonLink({
  label,
  icon,
  variant,
  size,
  className,
  ...props
}: IconButtonStyleProps & Omit<ComponentProps<typeof Link>, "aria-label" | "children">) {
  return (
    <Link aria-label={label} className={iconButtonClassName({ variant, size, className })} {...props}>
      <span aria-hidden="true" className="flex">
        {icon}
      </span>
    </Link>
  );
}
