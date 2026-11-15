// Русские числительные: 1 символ, 2 символа, 5 символов. Отдельный файл без
// JSX — чтобы тестироваться `node --experimental-strip-types --test`.
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.trunc(n));
  const m10 = abs % 10;
  const m100 = abs % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
