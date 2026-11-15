// Имена экранов галереи наград (Phase 2, итерация 6). Отдельный модуль без
// "use client": список читает серверный page.tsx.
export const REWARDS_SCREENS = [
  "Rewards-main",
  "Rewards-new",
  "Rewards-done",
  "Rewards-claimed",
  "Rewards-goal-edit",
  "Rewards-error",
  "Rewards-loading",
] as const;
export type RewardsScreen = (typeof REWARDS_SCREENS)[number];

export function isRewardsScreen(s: string | undefined): s is RewardsScreen {
  return (REWARDS_SCREENS as readonly string[]).includes(s ?? "");
}
