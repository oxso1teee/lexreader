"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode } from "react";
import { haptic, type HapticKind } from "@/lib/native";

// Оболочка любого момента: полноэкранный слой поверх приложения, колонка
// 390–430px по центру, нижняя зона с кнопкой, которая появляется после
// основной анимации (как в макетах — кнопку не нажать раньше, чем увидел
// праздник). Диалог модальный: фокус внутри, Esc/«назад» закрывают.
export interface MomentScreenProps {
  title: string;
  background?: string;
  foreground?: string;
  footer: ReactNode;
  /** Задержка появления нижней кнопки, с. */
  footerDelay?: number;
  haptic?: HapticKind | null;
  onClose: () => void;
  children: ReactNode;
}

export function MomentScreen({
  title,
  background,
  foreground,
  footer,
  footerDelay = 1.8,
  haptic: hapticKind = "success",
  onClose,
  children,
}: MomentScreenProps) {
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hapticKind) void haptic(hapticKind);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const prevFocus = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !rootRef.current) return;
      const items = rootRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
    // onClose меняется на каждом рендере провайдера — подписка нужна один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = {
    ...(background ? { "--mo-bg": background } : {}),
    ...(foreground ? { "--mo-fg": foreground } : {}),
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="mo-screen"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-testid="moment-screen"
    >
      <div className="mo-column">
        <span id={titleId} className="sr-only">
          {title}
        </span>
        <div className="mo-body">{children}</div>
        <div className="mo-footer mo-rise" style={{ animationDelay: `${footerDelay}s` }}>
          {footer}
        </div>
      </div>
    </div>
  );
}

export const WEEKDAYS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
