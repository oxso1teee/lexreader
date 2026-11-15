import type { CSSProperties } from "react";
import { avatarInitials } from "@/lib/avatar-initials";
import { avatarColor } from "@/lib/ui/avatar-color";
import { cx } from "@/lib/ui/cx";

// Аватар: картинка или инициалы на детерминированном цвете. Имя профиля в
// БД не хранится (только email), поэтому инициалы — из name, а если его нет —
// из email через существующий avatarInitials(). Декоративен по умолчанию
// (рядом обычно есть имя); если аватар — единственный носитель смысла,
// передай label.
function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

export function Avatar({
  name,
  email,
  src,
  size = "md",
  me = false,
  label,
  className,
}: {
  name?: string;
  email?: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** Кольцо «это я». */
  me?: boolean;
  label?: string;
  className?: string;
}) {
  const seed = name ?? email ?? "";
  const initials = name ? nameInitials(name) : email ? avatarInitials(email) : "?";
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cx("avatar", size !== "md" && `avatar-${size}`, me && "avatar-me", className)}
      style={{ "--avatar-bg": avatarColor(seed) } as CSSProperties}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- внешние/профильные аватары: размер известен CSS, оптимизатор не нужен
        <img src={src} alt="" />
      ) : (
        initials
      )}
    </span>
  );
}
