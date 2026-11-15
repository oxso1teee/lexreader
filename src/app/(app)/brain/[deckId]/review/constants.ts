import { XP_SOURCES } from "@/lib/xp/sources";

// "use server"-файлы (actions.ts) могут экспортировать только async-функции
// (Next.js build error: "Only async functions are allowed to be exported in
// a 'use server' file") — вынесено сюда, чтобы и actions.ts (сама сумма
// начисления), и review-session.tsx (отображение на Quit-confirm) видели
// одно число, а не дублировали литерал 10.
// Размер награды живёт в каталоге источников XP — здесь только для показа в UI.
export const PERFECT_SESSION_BONUS_XP: number = XP_SOURCES.perfect_session.amount ?? 0;
