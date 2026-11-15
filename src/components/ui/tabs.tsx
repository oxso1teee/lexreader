"use client";

import { createContext, useContext, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/ui/cx";

// Вкладки (WAI-ARIA tabs, автоактивация): ←/→ (и Home/End) перемещают фокус
// и переключают вкладку, roving tabindex — в Tab-порядке только активная.
// Панели не размонтируются — скрываются атрибутом hidden (состояние формы
// внутри вкладки не теряется).
interface TabsContextValue {
  base: string;
  value: string;
}
const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  label,
  variant = "segmented",
  className,
  children,
}: {
  items: readonly TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Доступное имя списка вкладок: «Период». */
  label: string;
  variant?: "segmented" | "underline";
  className?: string;
  /** Панели — <TabPanel value="…">. */
  children?: ReactNode;
}) {
  const base = useId();
  const [inner, setInner] = useState(defaultValue ?? items.find((i) => !i.disabled)?.value ?? "");
  const current = value ?? inner;
  const listRef = useRef<HTMLDivElement>(null);

  function select(next: string) {
    setInner(next);
    onValueChange?.(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const enabled = items.filter((i) => !i.disabled);
    const index = enabled.findIndex((i) => i.value === current);
    let target: TabItem | undefined;
    if (e.key === "ArrowRight") target = enabled[(index + 1) % enabled.length];
    else if (e.key === "ArrowLeft") target = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (e.key === "Home") target = enabled[0];
    else if (e.key === "End") target = enabled[enabled.length - 1];
    if (!target) return;
    e.preventDefault();
    select(target.value);
    listRef.current?.querySelector<HTMLElement>(`[data-tab-value="${CSS.escape(target.value)}"]`)?.focus();
  }

  return (
    <TabsContext.Provider value={{ base, value: current }}>
      <div className={className}>
        <div ref={listRef} role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cx("tabs-list", variant === "underline" && "tabs-underline")}>
          {items.map((item) => {
            const selected = item.value === current;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={`${base}-tab-${item.value}`}
                data-tab-value={item.value}
                aria-selected={selected}
                // aria-controls только когда панели реально рендерятся внутри Tabs —
                // иначе ссылка указывает в пустоту (axe: aria-valid-attr-value).
                aria-controls={children ? `${base}-panel-${item.value}` : undefined}
                tabIndex={selected ? 0 : -1}
                disabled={item.disabled}
                className="tab"
                onClick={() => select(item.value)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabPanel({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabPanel must be rendered inside <Tabs>");
  return (
    <div
      role="tabpanel"
      id={`${ctx.base}-panel-${value}`}
      aria-labelledby={`${ctx.base}-tab-${value}`}
      hidden={ctx.value !== value}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
