"use client";

import type { ReactNode } from "react";
import { Dialog as UiDialog } from "@/components/ui/dialog";

// Исторический API (Slice 5): диалог монтируется условно самим вызывающим
// кодом, поэтому здесь open всегда true. Вся механика (портал, ловушка
// фокуса, возврат фокуса, Escape, блокировка прокрутки, a11y) — в
// components/ui/dialog.tsx; этот файл оставлен, чтобы не менять четыре
// экрана Language Twin. Новый код использует ui/Dialog напрямую.
export default function Dialog({
  titleId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <UiDialog open title={title} titleId={titleId} onClose={onClose}>
      {children}
    </UiDialog>
  );
}
