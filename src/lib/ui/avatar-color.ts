// Цвет аватара без своего изображения — детерминированно по строке-зерну
// (email/имя), чтобы один и тот же человек выглядел одинаково везде.
// Только заливки, одинаково глубокие в обеих темах (белая буква ≥ 4.5:1) —
// поэтому не --danger-text/--sun-text, которые в тёмной теме светлеют.
export const AVATAR_COLORS = [
  "var(--sky-fill)",
  "var(--ember-fill)",
  "var(--leaf)",
  "var(--danger)",
  "var(--ink-fill)",
] as const;

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
