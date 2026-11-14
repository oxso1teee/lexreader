// Имена экранов галереи плеера уроков. Отдельный модуль без "use client":
// список читает серверный page.tsx, а константа, экспортированная из
// клиентского файла, на сервере превращается в client reference, а не в значение.
export const PLAYER_SCREENS = ["Player-lesson", "Player-check", "Player-topic", "Player-reading", "Player-locked"] as const;
export type PlayerScreen = (typeof PLAYER_SCREENS)[number];

export const STATIC_LESSON_SCREENS = [
  "Player-loading",
  "Player-fatal",
  "Player-fatal-auth",
  "Complete-passed",
  "Complete-perfect",
  "Complete-failed",
  "Complete-check-failed",
  "Complete-first-win",
  "Complete-xp-pending",
  "Complete-xp-via-lesson",
  "Complete-xp-via-check",
  "Start-card-new",
  "Start-card-resume",
  "Start-card-done",
  "Start-card-done-check",
] as const;
export type StaticLessonScreen = (typeof STATIC_LESSON_SCREENS)[number];

export const LESSON_SCREENS = [...PLAYER_SCREENS, ...STATIC_LESSON_SCREENS] as const;
export type LessonScreen = (typeof LESSON_SCREENS)[number];

export function isLessonScreen(s: string | undefined): s is LessonScreen {
  return (LESSON_SCREENS as readonly string[]).includes(s ?? "");
}

export function isPlayerScreen(s: LessonScreen): s is PlayerScreen {
  return (PLAYER_SCREENS as readonly string[]).includes(s);
}
