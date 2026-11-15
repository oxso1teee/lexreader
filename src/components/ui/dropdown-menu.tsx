"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";
import { IconButton } from "./icon-button";

// Меню действий (WAI-ARIA menu button): триггер aria-haspopup/aria-expanded;
// список role="menu"; стрелки ↑↓ / Home / End, набор первой буквы, Escape
// закрывает и возвращает фокус на триггер, Tab закрывает, клик снаружи
// закрывает. Только для действий (не для навигации по сайту и не для выбора
// значения формы — там Select).
export interface MenuItem {
  key?: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
}

export function DropdownMenu({
  label,
  items,
  trigger,
  align = "end",
  className,
}: {
  /** Доступное имя меню / триггера: «Действия с колодой». */
  label: string;
  items: readonly MenuItem[];
  /** Своё содержимое триггера; по умолчанию — IconButton «⋯». */
  trigger?: ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function enabledItems() {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
  }

  useEffect(() => {
    if (!open) return;
    enabledItems()[0]?.focus();
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const list = enabledItems();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(index + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(index - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const ch = e.key.toLowerCase();
      const match = [...list.slice(index + 1), ...list.slice(0, index + 1)].find((el) => el.textContent?.trim().toLowerCase().startsWith(ch));
      match?.focus();
    }
  }

  const itemClass = (item: MenuItem) => cx("menu-item", item.danger && "menu-item-danger");

  return (
    <div ref={rootRef} className={cx("relative inline-flex", className)}>
      {trigger ? (
        <button
          ref={triggerRef}
          type="button"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-menu` : undefined}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-2"
        >
          {trigger}
        </button>
      ) : (
        <IconButton
          ref={triggerRef}
          label={label}
          icon={<MoreHorizontal className="h-5 w-5" />}
          variant="boxed"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? `${id}-menu` : undefined}
          onClick={() => setOpen((v) => !v)}
        />
      )}
      {open && (
        <div ref={menuRef} id={`${id}-menu`} role="menu" aria-label={label} onKeyDown={onMenuKeyDown} className={cx("menu", align === "end" && "menu-end", "top-full")}>
          {items.map((item, i) => {
            const common = {
              role: "menuitem" as const,
              tabIndex: -1,
              "aria-disabled": item.disabled || undefined,
              className: itemClass(item),
            };
            const content = (
              <>
                {item.icon && <span aria-hidden="true" className="flex">{item.icon}</span>}
                {item.label}
              </>
            );
            if (item.href && !item.disabled) {
              return (
                <Link key={item.key ?? i} href={item.href} {...common} onClick={() => close(false)}>
                  {content}
                </Link>
              );
            }
            return (
              <button
                key={item.key ?? i}
                type="button"
                {...common}
                onClick={() => {
                  if (item.disabled) return;
                  close(true);
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
