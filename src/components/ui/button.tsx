import Link from "next/link";
import type { ComponentProps } from "react";

// redesign/duolingo-flat, phase 3 — механика и цвета в src/styles/button.css.
// Две обёртки вместо полиморфного `as`: <Button> для действий, <ButtonLink>
// для навигации (next/link) — обе собирают className через buttonClassName(),
// его же можно повесить на что-то третье, если понадобится. Без .focus-ring:
// её :focus-visible (tokens.css, вне слоя) перебил бы скругление на 6px —
// глобального :focus-visible outline достаточно.
export type ButtonVariant = "leaf" | "sky" | "ember" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
}

export function buttonClassName({
  variant = "leaf",
  size = "md",
  pill = false,
  className,
}: ButtonStyleProps & { className?: string } = {}) {
  return ["btn", `btn-${variant}`, `btn-${size}`, pill && "btn-pill", className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  pill,
  className,
  type = "button",
  ...props
}: ButtonStyleProps & ComponentProps<"button">) {
  return <button type={type} className={buttonClassName({ variant, size, pill, className })} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  pill,
  className,
  ...props
}: ButtonStyleProps & ComponentProps<typeof Link>) {
  return <Link className={buttonClassName({ variant, size, pill, className })} {...props} />;
}
