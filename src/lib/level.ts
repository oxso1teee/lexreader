// docs/moments/ROADMAP.md, этап 1 — "Уровень — число, считается из общего
// XP (level = f(xp)); звания из src/lib/ranks.ts остаются подписью". Ни
// ROADMAP, ни макеты (Level-up.dc.html) не фиксируют саму формулу —
// продуктовое решение, принимается здесь, можно оспорить: шаг 100 XP на
// уровень, без ускорения/замедления с ростом уровня. Простая и предсказуемая
// кривая; при желании ужесточить прогрессию позже — поменять только
// LEVEL_STEP_XP, остальной код (xpForLevel/levelProgress) не завязан на
// константу напрямую.
const LEVEL_STEP_XP = 100;

/** Уровень 1 начинается с 0 XP, дальше растёт на LEVEL_STEP_XP за уровень. */
export function levelForXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / LEVEL_STEP_XP) + 1;
}

/** Суммарный XP, с которого начинается данный уровень (level=1 -> 0). */
export function xpForLevel(level: number): number {
  return Math.max(0, level - 1) * LEVEL_STEP_XP;
}

export interface LevelProgress {
  level: number;
  /** XP, накопленный уже в пределах текущего уровня. */
  xpIntoLevel: number;
  /** Сколько XP нужно набрать внутри уровня, чтобы перейти на следующий. */
  xpForNextLevel: number;
  /** 0..1 — прогресс-бар до следующего уровня (Level-up.dc.html). */
  progress: number;
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp);
  const xpIntoLevel = Math.max(0, xp) - xpForLevel(level);
  return {
    level,
    xpIntoLevel,
    xpForNextLevel: LEVEL_STEP_XP,
    progress: Math.min(1, xpIntoLevel / LEVEL_STEP_XP),
  };
}
