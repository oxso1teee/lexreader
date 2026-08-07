"use client";

import { useState } from "react";
import Dialog from "@/components/product/language-twin/dialog";

export default function HowCalculated({
  selfReportedLevel,
  diagnosticLevelRange,
  behavioralLevelRange,
}: {
  selfReportedLevel: string | null;
  diagnosticLevelRange: string | null;
  behavioralLevelRange: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring text-sm font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline"
      >
        Как это посчитано?
      </button>
      {open && (
        <Dialog titleId="how-calculated-title" title="Как это посчитано" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 text-sm">
            <p>
              Уровень строится не из одного теста — мы смотрим на три независимых сигнала и показываем их
              вместе только если хотя бы два примерно совпадают.
            </p>
            <div className="rounded-lg bg-[var(--surface-muted)] p-3">
              <p className="font-semibold">Самооценка при регистрации</p>
              <p className="text-[var(--text-secondary)]">{selfReportedLevel ?? "не указана"}</p>
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
