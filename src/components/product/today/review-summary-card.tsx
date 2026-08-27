"use client";

import Link from "next/link";
import { track } from "@/lib/posthog-client";

// FSRS-детали (scheduler_type/stability/etc.) пользователю не показываем —
// только количество карточек, как и просит задание.
//
// Когда due-карточки есть, decidePrimaryAction() (src/lib/today.ts) уже
// делает "review" единственным primary CTA страницы — ссылка здесь
// намеренно не дублирует её текст/стиль (было "Повторить" тем же
// bold-pill, что и primary CTA — двусмысленно для скринридеров и
// одинаковый accessible name для двух разных ссылок, найдено
// e2e/unified-shell-today.spec.ts), а даёт лёгкий secondary-путь в тот же
// экран повторения с другой формулировкой.
export default function ReviewSummaryCard({ dueCount }: { dueCount: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--surface)] p-4 shadow-sm">
      <div>
        <p className="text-body-sm text-[var(--text-secondary)]">Готово к повторению</p>
        <p className="text-h3 mt-0.5">{dueCount > 0 ? `${dueCount} к повтору` : "Всё повторено"}</p>
      </div>
      {dueCount > 0 && (
        <Link
          href="/brain/all/review"
          onClick={() => track("review_entry_clicked", { destination: "/brain/all/review" })}
          className="focus-ring text-body-sm font-semibold text-[var(--color-forest-text)]"
        >
          Все карточки →
        </Link>
      )}
    </div>
  );
}
