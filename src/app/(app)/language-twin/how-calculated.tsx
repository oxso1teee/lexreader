"use client";

import { useState } from "react";
import Link from "next/link";
import Dialog from "@/components/product/language-twin/dialog";

// M3 Slice 9 (plan doc §14/§31) — Placement v2 is a 4th, distinct signal,
// never merged with the others into one fake exact level. Self-reported/
// mini-diagnostic/behavioral are all untouched by this slice; Placement's
// own onboarding-time self-report (self_reported_cefr) is intentionally
// kept out of this dialog to avoid a confusing 3rd "self-report" row —
// Placement's range already reflects it when a real attempt exists.
export default function HowCalculated({
  selfReportedLevel,
  diagnosticLevelRange,
  placementRange,
  placementSkipped,
  behavioralLevelRange,
}: {
  selfReportedLevel: string | null;
  diagnosticLevelRange: string | null;
  placementRange: string | null;
  placementSkipped: boolean;
  behavioralLevelRange: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
      >
        Как это посчитано?
      </button>
      {open && (
        <Dialog titleId="how-calculated-title" title="Как это посчитано" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Уровень строится не из одного теста — мы смотрим на несколько независимых сигналов и показываем
              их вместе только если хотя бы два примерно совпадают.
            </p>
            <div className="rounded-lg bg-[var(--surface-muted)] p-3">
              <p className="font-semibold">Самооценка при регистрации</p>
              <p className="text-[var(--text-secondary)]">{selfReportedLevel ?? "не указана"}</p>
            </div>
            <div className="rounded-lg bg-[var(--surface-muted)] p-3">
              <p className="font-semibold">Диагностика при регистрации (Placement)</p>
              <p className="text-[var(--text-secondary)]">
                {placementRange ?? (placementSkipped ? "пропущена" : "не пройдена")}
              </p>
              <Link href="/onboarding/placement?retake=1" className="focus-ring mt-1 inline-block text-xs font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline">
                {placementRange ? "Обновить диагностику" : "Пройти диагностику"}
              </Link>
            </div>
            <div className="rounded-lg bg-[var(--surface-muted)] p-3">
              <p className="font-semibold">Мини-диагностика</p>
              <p className="text-[var(--text-secondary)]">{diagnosticLevelRange ?? "не пройдена"}</p>
            </div>
            <div className="rounded-lg bg-[var(--surface-muted)] p-3">
              <p className="font-semibold">Поведение в приложении</p>
              <p className="text-[var(--text-secondary)]">{behavioralLevelRange ?? "недостаточно данных"}</p>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Мы никогда не показываем это как «B1.73» или «ровно 3841 слово» — такая точность была бы
              обманчивой. Все вычисления идут на нашем сервере по твоим собственным данным, без внешних
              ИИ-сервисов.
            </p>
          </div>
        </Dialog>
      )}
    </>
  );
}
