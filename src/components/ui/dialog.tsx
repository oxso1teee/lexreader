"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/ui/cx";
import { IconButton } from "./icon-button";

// Модальные слои: Dialog (нижний шит на mobile → окно по центру на sm+) и
// Drawer (нижний шит на mobile → правая панель на md+) — один механизм:
//   • портал в <body> (не зависит от overflow/stacking предков)
//   • aria-modal + aria-labelledby/-describedby, role="dialog"
//   • фокус: уходит внутрь при открытии, Tab/Shift+Tab зациклены, при
//     закрытии возвращается на элемент, открывший слой
//   • Escape и клик по подложке закрывают (подложка — только если нажатие
//     началось на ней, чтобы выделение текста не закрывало окно)
//   • прокрутка страницы под слоем заблокирована
// Это обобщение product/language-twin/dialog.tsx (тот теперь использует его).
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const subscribeNoop = () => () => {};

function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Для обратной совместимости со старым Dialog (стабильный id заголовка). */
  titleId?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
  /** Закрытие по Escape/подложке недоступно (например, идёт сохранение). */
  dismissible?: boolean;
  className?: string;
}

function Overlay({
  variant,
  open,
  onClose,
  title,
  description,
  titleId,
  children,
  footer,
  size = "md",
  dismissible = true,
  className,
}: OverlayProps & { variant: "dialog" | "drawer" }) {
  const isClient = useIsClient();
  const generated = useId();
  const labelId = titleId ?? `${generated}-title`;
  const descId = `${generated}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const pressedOnScrim = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const panel = panelRef.current;

    // Начальный фокус — первый интерактивный элемент ТЕЛА (не кнопка
    // «Закрыть» в шапке), иначе экранный диктор начинает с закрытия; если
    // его нет — сама панель.
    const body = panel?.querySelector<HTMLElement>(".overlay-body");
    (body?.querySelector<HTMLElement>(FOCUSABLE) ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && document.contains(trigger)) trigger.focus();
    };
  }, [open, dismissible]);

  if (!open || !isClient) return null;

  return createPortal(
    <div
      className={cx("overlay-scrim", variant === "dialog" ? "overlay-dialog" : "overlay-drawer")}
      onMouseDown={(e) => {
        pressedOnScrim.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (dismissible && pressedOnScrim.current && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx("overlay-panel", size === "lg" && "overlay-panel-lg", className)}
      >
        <div className="overlay-header">
          <div className="min-w-0">
            <h2 id={labelId} className="text-h2">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-body-sm mt-1 text-[var(--text-secondary)]">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Закрыть" icon={<X className="h-5 w-5" />} size="sm" onClick={onClose} disabled={!dismissible} />
        </div>
        <div className="overlay-body">{children}</div>
        {footer && <div className="overlay-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog(props: OverlayProps) {
  return <Overlay variant="dialog" {...props} />;
}

export function Drawer(props: OverlayProps) {
  return <Overlay variant="drawer" {...props} />;
}
