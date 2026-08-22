"use client";

import { motion, useReducedMotion } from "motion/react";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел B.1 —
// достижение дневной цели раньше рендерилось как обычная строка "N / M
// слов" без разницы в состоянии "цель уже достигнута". Тот же
// prefers-reduced-motion принцип, что и session-complete.tsx/globals.css's
// flip-reveal — чисто декоративно, не меняет сам расчёт newWordsToday
// (передаётся как есть из home/page.tsx's реального supabase-запроса).
export default function DailyGoalRow({ current, goal }: { current: number; goal: number }) {
  const reached = current >= goal;
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-body-sm text-[var(--text-secondary)]">Дневная цель</p>
      <motion.p
        key={reached ? "reached" : "pending"}
        initial={reduceMotion || !reached ? false : { scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 16 }}
        className={`text-body-sm font-semibold ${reached ? "text-[var(--color-success-text)]" : ""}`}
      >
        {reached ? "✓ " : ""}
        {current} / {goal} слов
      </motion.p>
    </div>
  );
}
