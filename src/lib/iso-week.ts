// Общая точка правды для "начало этой недели" (понедельник, UTC) — до этой
// фичи (docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C,
// Тир 3 — недельная лига) одна и та же математика была независимо
// продублирована в src/lib/streak.ts, app/(app)/progress/page.tsx и
// app/(app)/home/page.tsx. Извлечено сюда при добавлении четвёртого
// потребителя (лидерборд) вместо копирования в четвёртый раз; три старых
// места переведены на этот импорт тем же PR.
export function isoWeekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // getUTCDay(): 0=вс..6=сб → 0=пн..6=вс
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}
