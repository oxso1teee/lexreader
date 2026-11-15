// Вынесено из actions.ts: "use server"-файл может экспортировать только
// async-функции — константа оттуда роняла страницу онбординга.
export const GOAL_TIERS = [
  { minutes: 5, xp: 20, label: "Лёгкий", sub: "Пара страниц за кофе" },
  { minutes: 10, xp: 50, label: "Обычный", sub: "Глава за два дня" },
  { minutes: 15, xp: 80, label: "Серьёзный", sub: "Глава в день" },
  { minutes: 20, xp: 120, label: "Интенсив", sub: "Для тех, кто спешит" },
] as const;
