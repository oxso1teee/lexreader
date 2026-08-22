"use client";

import { motion, useReducedMotion } from "motion/react";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел B.1 —
// переходы между страницами внутри (app) были жёсткой сменой без
// transition. template.tsx (в отличие от layout.tsx) ремонтируется на
// каждую навигацию по документированному поведению Next.js App Router
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
// template.md) — значит анимация проигрывается заново при каждом переходе
// сама, без ручного key от usePathname. AppShell (сайдбар/нижняя
// навигация) объявлен в (app)/layout.tsx, а не тут, поэтому не
// перерисовывается и не мигает при переходах.
//
// Только вход (fade+8px), без выхода — Next не даёт template.tsx участвовать
// в AnimatePresence-выходе (сам React-элемент подменяется мгновенно), а
// такая асимметрия здесь незаметна и не стоит переусложнения. Тот же
// useReducedMotion(), что и в session-complete.tsx/daily-goal-row.tsx.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
