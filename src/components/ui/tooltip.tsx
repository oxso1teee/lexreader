"use client";

import { cloneElement, useEffect, useId, useState, type ReactElement } from "react";
import { cx } from "@/lib/ui/cx";

// Подсказка (WCAG 1.4.13): появляется по hover И по фокусу с клавиатуры,
// закрывается Escape, остаётся видимой при наведении на саму подсказку
// (hoverable), описывает триггер через aria-describedby. Содержимое — только
// короткий текст; интерактив внутри подсказки не допускается.
export function Tooltip({
  content,
  placement = "top",
  children,
  className,
}: {
  content: string;
  placement?: "top" | "bottom";
  /** Один элемент-триггер (кнопка, ссылка, иконка-кнопка). */
  children: ReactElement<{ "aria-describedby"?: string }>;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <span
      className={cx("tooltip-root", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {cloneElement(children, { "aria-describedby": id })}
      <span id={id} role="tooltip" hidden={!open} className={cx("tooltip", `tooltip-${placement}`)}>
        {content}
      </span>
    </span>
  );
}
