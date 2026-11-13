import Link from "next/link";
import type { ComponentProps } from "react";
import { cx } from "@/lib/ui/cx";
import { Spinner } from "./skeleton";

// redesign/duolingo-flat, phase 3 — механика и цвета в src/styles/button.css.
// Две обёртки вместо полиморфного `as`: <Button> для действий, <ButtonLink>
// для навигации (next/link) — обе собирают className через buttonClassName(),
// его же можно повесить на что-то третье, если понадобится. Без .focus-ring:
// её :focus-visible (tokens.css, вне слоя) перебил бы скругление на 6px —
// глобального :focus-visible outline достаточно.
export type ButtonVariant = "leaf" | "sky" | "ember" | "ghost" | "danger" | "sun" | "ink";
export type ButtonSize = "md" | "sm";

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  /** На всю ширину контейнера (dock, формы на mobile). */
  block?: boolean;
}

export function buttonClassName({
  variant = "leaf",
  size = "md",
  pill = false,
  block = false,
  className,
}: ButtonStyleProps & { className?: string } = {}) {
  return cx("btn", `btn-${variant}`, `btn-${size}`, pill && "btn-pill", block && "btn-block", className);
}

// loading: кнопка не меняет размер (подпись остаётся), клики и повторная
// отправка блокируются, скринридер слышит «занято» через aria-busy. Нативный
// disabled не используем намеренно — иначе фокус теряется в момент отправки.
export function Button({
  variant,
  size,
  pill,
  block,
  loading = false,
  className,
  type = "button",
  children,
  onClick,
  ...props
}: ButtonStyleProps & { loading?: boolean } & ComponentProps<"button">) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, pill, block, className })}
      aria-busy={loading || undefined}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  pill,
  block,
  className,
  ...props
}: ButtonStyleProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClassName({ variant, size, pill, block, className })} {...props} />;
}
