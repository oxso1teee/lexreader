"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { getCurrentStreak, getLanguageTwinUpdateAction, type LanguageTwinSessionUpdate } from "./actions";
import { completeMissionAction } from "@/app/(app)/missions/actions";
import { track } from "@/lib/posthog-client";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import type { PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел B.1 —
// первая установка motion (framer-motion) в проекте. Same
// prefers-reduced-motion discipline as globals.css's existing flip-reveal
// keyframe (useReducedMotion() is motion's own hook for the identical media
// query) — purely decorative, no layout/timing dependency for anything
// below (the "К практике" / mission-result links are interactive
// immediately regardless of whether this plays).
const CONFETTI = ["🎉", "✨", "🎊", "⭐"];

// Review mockup alignment — правильное русское склонение "слово" для
// подзаголовка ("Ты повторил N слов/слово/слова за сессию"), тот же приём,
// что materialsCountLabel/formatPartsCount уже применяют для похожих счётчиков
// в library-item.ts/library-item-card.tsx.
function wordCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word: string;
  if (mod10 === 1 && mod100 !== 11) word = "слово";
  else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) word = "слова";
  else word = "слов";
  return `${count} ${word}`;
}

export default function SessionComplete({
  count,
  newRecord = false,
  missionId = null,
  missionCorrectCount = 0,
  missionIncorrectCount = 0,
  cards = [],
}: {
  count: number;
  newRecord?: boolean;
  // Missions v1 §11-13: targeted missions (vocab_activation/review_recovery/
  // phrase_activation) redirect here with a real flashcard set — completing
  // this same Practice session IS completing the mission. missionCorrectCount/
  // missionIncorrectCount are the mode's own genuine per-card grades (see
  // each mode's tally state), never a fabricated number.
  missionId?: string | null;
  missionCorrectCount?: number;
  missionIncorrectCount?: number;
  // Review mockup alignment — реальные слова этой сессии, переданные
  // review-session.tsx (прямой родитель, cards уже было в его состоянии).
  // front — язык изучения, back — родной (см. speak() в review-session.tsx).
  cards?: { front: string; back: string }[];
}) {
  const [streak, setStreak] = useState<number | null>(null);
  const [twinUpdate, setTwinUpdate] = useState<LanguageTwinSessionUpdate | null>(null);
  const [missionDone, setMissionDone] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    getCurrentStreak().then(setStreak);
    if (missionId) {
      completeMissionAction(missionId, { correct: missionCorrectCount, incorrect: missionIncorrectCount }).then(
        (result) => {
          setMissionDone(true);
          // No mission_type here (this path never learns it) — mirrors other
          // events in this table that carry no properties at all rather than
          // guessing or fetching just to enrich analytics.
          track("mission_completed", {});
          if (result?.languageTwinUpdate) {
            const u = result.languageTwinUpdate;
            setTwinUpdate({
              patternTitle: u.patternTitle,
              category: u.category as PatternCategory,
              status: u.status as PatternStatus,
              trend: u.trend as Trend,
            });
          } else {
            getLanguageTwinUpdateAction().then(setTwinUpdate);
          }
        },
      );
    } else {
      getLanguageTwinUpdateAction().then(setTwinUpdate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      {!reduceMotion && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 flex justify-center gap-4 text-2xl">
          {CONFETTI.map((emoji, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 0, scale: 0.4, rotate: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: -36 - i * 8, scale: 1, rotate: i % 2 ? 25 : -25 }}
              transition={{ duration: 0.9, delay: i * 0.06, ease: "easeOut" }}
            >
              {emoji}
            </motion.span>
          ))}
        </div>
      )}
      {/* Review mockup alignment — бейдж-кружок (новый элемент, референс не
          описывал ничего похожего в прежней версии этого экрана). Check из
          lucide-react — отдельная от круга галочка, а не готовая
          комбинированная иконка "check-in-circle" (референс рисует их как
          два слоя: круг с бордером + иконка внутри). */}
      <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 border-[var(--color-forest)] bg-[var(--color-forest-tint)]">
        <Check aria-hidden="true" className="h-10 w-10 text-[var(--color-forest)]" strokeWidth={2.5} />
      </div>
      {/* Playfair Display сознательно не подключаем здесь — тот же
          компромисс, что и у контекст-предложения в review-session.tsx:
          "use client"-компонент, next/font/google в таком контексте не
          задокументирован явно, а протянуть шрифт через layout.tsx/
          review-mode-switcher.tsx — вне границ задачи (обе эти правки
          запрещены). Курсив+bold на существующем sans-стеке — тот же
          визуальный вес без нового font-loading. */}
      <motion.p
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="text-[20px] font-bold italic"
      >
        Сессия завершена
      </motion.p>
      <p className="text-[12px] text-[var(--text-secondary)]">Ты повторил {wordCountLabel(count)} за сессию</p>
      {newRecord && (
        <p className="font-medium text-[var(--color-forest-text)]">🏆 Новый личный рекорд сессии!</p>
      )}
      {streak !== null && <p className="text-black/60 dark:text-white/60">Стрик: {streak} 🔥</p>}
      {/* Review mockup alignment — список слов сессии (новый элемент). Все
          переданные cards — то есть все реально оценённые в этой сессии
          карточки (review-session.tsx передаёт ровно свой массив cards),
          без выдумывания и без обрезки. max-h + overflow — просто защита от
          неограниченно длинной страницы на большой сессии (20+ карточек),
          не про данные. */}
      {cards.length > 0 && (
        <div className="mt-1 flex max-h-64 w-full max-w-sm flex-col gap-1.5 overflow-y-auto">
          {cards.map((c, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-card px-3 py-2 text-left">
              <p className="text-[12.5px] font-bold">{c.front}</p>
              <p className="text-[10.5px] text-[var(--text-secondary)]">{c.back}</p>
            </div>
          ))}
        </div>
      )}
      {twinUpdate && (
        <div className="mt-1 flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm">
          <p className="text-sm font-semibold">Мой английский обновлён</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <CategoryBadge category={twinUpdate.category} />
            <StatusBadge status={twinUpdate.status} />
            <TrendIndicator trend={twinUpdate.trend} />
          </div>
          <p className="text-xs text-black/60 dark:text-white/60">{twinUpdate.patternTitle}</p>
        </div>
      )}
      {missionId && missionDone && (
        <Link
          href={`/missions/${missionId}`}
          className="mt-2 rounded-full border border-black/15 px-5 py-3 font-medium hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
        >
          Посмотреть результат миссии →
        </Link>
      )}
      {/* Review mockup alignment — forest вместо чёрно-белого CTA, тот же
          дрейф-от-бренда паттерн, зачищенный на каждом экране этой серии;
          референс явно этот элемент не описывает, но конфликта тоже нет. */}
      <Link
        href="/brain"
        className="mt-4 rounded-full bg-[var(--color-forest)] px-5 py-3 font-medium text-white"
      >
        К практике
      </Link>
    </div>
  );
}
