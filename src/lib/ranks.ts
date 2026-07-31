// Раздел 5 промта 2026-07-30 (полировка): сквозной уровень прогресса —
// не соревнование с другими, только с собой вчерашним.
export const RANKS = [
  { minXp: 0, title: "Новичок" },
  { minXp: 300, title: "Следопыт слов" },
  { minXp: 1500, title: "Начитанный" },
  { minXp: 5000, title: "Полиглот" },
] as const;

export interface RankInfo {
  title: string;
  xp: number;
  nextTitle: string | null;
  nextXp: number | null;
  progress: number; // 0..1 до следующего звания
}

export function rankForXp(xp: number): RankInfo {
  const sorted = [...RANKS].sort((a, b) => b.minXp - a.minXp);
  const current = sorted.find((r) => xp >= r.minXp) ?? RANKS[0];
  const next = RANKS.find((r) => r.minXp > xp) ?? null;

  const progress = next
    ? Math.min(1, (xp - current.minXp) / (next.minXp - current.minXp))
    : 1;

  return {
    title: current.title,
    xp,
    nextTitle: next?.title ?? null,
    nextXp: next?.minXp ?? null,
    progress,
  };
}
