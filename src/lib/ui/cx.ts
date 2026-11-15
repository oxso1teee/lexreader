// Склейка className без зависимости (clsx/tailwind-merge в проекте нет).
// Ложные значения отбрасываются; порядок сохраняется — позднее значение
// выигрывает только через CSS-слои (@layer components < utilities), а не
// через порядок в строке.
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  return values.filter((v) => v !== false && v !== null && v !== undefined && v !== "").join(" ");
}
