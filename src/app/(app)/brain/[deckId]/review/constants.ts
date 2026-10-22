// "use server"-файлы (actions.ts) могут экспортировать только async-функции
// (Next.js build error: "Only async functions are allowed to be exported in
// a 'use server' file") — вынесено сюда, чтобы и actions.ts (сама сумма
// начисления), и review-session.tsx (отображение на Quit-confirm) видели
// одно число, а не дублировали литерал 10.
export const PERFECT_SESSION_BONUS_XP = 10;
