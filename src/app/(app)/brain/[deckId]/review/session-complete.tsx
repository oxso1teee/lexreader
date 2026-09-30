"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, Flame, Trophy } from "lucide-react";
import { getCurrentStreak, getLanguageTwinUpdateAction, type LanguageTwinSessionUpdate } from "./actions";
import { completeMissionAction } from "@/app/(app)/missions/actions";
import { track } from "@/lib/posthog-client";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import type { PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";
import { cardClassName } from "@/components/ui/card";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел B.1 —
// первая установка motion (framer-motion) в проекте. Same
// prefers-reduced-motion discipline as globals.css's existing flip-reveal
// keyframe (useReducedMotion() is motion's own hook for the identical media
// query) — purely decorative, no layout/timing dependency for anything
// below (the "К практике" / mission-result links are interactive
// immediately regardless of whether this plays).
//
// redesign/duolingo-flat phase 9 — вместо 4 эмодзи плоские конфетти:
// прямоугольники/кружки сплошными цветами палитры (без градиентов), разлёт
// от бейджа-галочки в стороны, короткий подскок вверх и падение вниз с
// вращением. Траектории заданы константами, а не Math.random() — рендер
// остаётся чистым и одинаковым между SSR/CSR.
const CONFETTI: { color: string; w: number; h: number; round: boolean; x: number; lift: number; fall: number; spin: number }[] = [
  { color: "var(--leaf)", w: 10, h: 6, round: false, x: -130, lift: -70, fall: 150, spin: -420 },
  { color: "var(--sky)", w: 8, h: 8, round: true, x: -95, lift: -95, fall: 120, spin: 300 },
  { color: "var(--ember)", w: 6, h: 12, round: false, x: -60, lift: -80, fall: 175, spin: -260 },
  { color: "var(--sun)", w: 9, h: 9, round: true, x: -25, lift: -105, fall: 135, spin: 380 },
  { color: "var(--danger)", w: 11, h: 6, round: false, x: 10, lift: -90, fall: 160, spin: -340 },
  { color: "var(--leaf)", w: 7, h: 7, round: true, x: 40, lift: -100, fall: 125, spin: 260 },
  { color: "var(--sky)", w: 6, h: 12, round: false, x: 75, lift: -75, fall: 170, spin: -300 },
  { color: "var(--ember)", w: 8, h: 8, round: true, x: 105, lift: -85, fall: 140, spin: 420 },
  { color: "var(--sun)", w: 10, h: 6, round: false, x: 140, lift: -65, fall: 155, spin: -380 },
  { color: "var(--danger)", w: 7, h: 7, round: true, x: -150, lift: -55, fall: 110, spin: 240 },
];

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
      {/* Review mockup alignment — бейдж-кружок (новый элемент, референс не
          описывал ничего похожего в прежней версии этого экрана). Check из
          lucide-react — отдельная от круга галочка, а не готовая
          комбинированная иконка "check-in-circle" (референс рисует их как
          два слоя: круг с бордером + иконка внутри). */}
      <div className="relative">
        <div className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-2 border-[var(--color-forest)] bg-[var(--color-forest-tint)]">
          <Check aria-hidden="true" className="h-10 w-10 text-[var(--color-forest)]" strokeWidth={2.5} />
        </div>
        {!reduceMotion && (
          <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2">
            {CONFETTI.map((p, i) => (
              <motion.span
                key={i}
                className="absolute block"
                style={{
                  width: p.w,
                  height: p.h,
                  left: -p.w / 2,
                  top: -p.h / 2,
                  borderRadius: p.round ? 999 : 2,
                  backgroundColor: p.color,
                }}
                initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
                animate={{ opacity: [0, 1, 1, 0], x: p.x, y: [0, p.lift, p.fall], rotate: p.spin }}
                transition={{ duration: 1.4, delay: i * 0.03, ease: "easeOut" }}
              />
            ))}
          </div>
        )}
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
        <p className="flex items-center gap-1.5 font-medium text-[var(--color-forest-text)]">
          <Trophy aria-hidden="true" className="h-4 w-4" />
          Новый личный рекорд сессии!
        </p>
      )}
      {streak !== null && (
        <p className="flex items-center gap-1 text-black/60 dark:text-white/60">
          Стрик: {streak}
          <Flame aria-hidden="true" className="h-4 w-4 text-orange-500" />
        </p>
      )}
      {/* Review mockup alignment — список слов сессии (новый элемент). Все
          переданные cards — то есть все реально оценённые в этой сессии
          карточки (review-session.tsx передаёт ровно свой массив cards),
          без выдумывания и без обрезки. max-h + overflow — просто защита от
          неограниченно длинной страницы на большой сессии (20+ карточек),
          не про данные. */}
      {cards.length > 0 && (
        <div className="mt-1 flex max-h-64 w-full max-w-sm flex-col gap-1.5 overflow-y-auto">
          {cards.map((c, i) => (
            <div key={i} className={cardClassName({ className: "rounded-xl px-3 py-2 text-left" })}>
              <p className="text-[12.5px] font-bold">{c.front}</p>
              <p className="text-[10.5px] text-[var(--text-secondary)]">{c.back}</p>
            </div>
          ))}
        </div>
      )}
      {twinUpdate && (
        <div className={cardClassName({ className: "mt-1 flex flex-col items-center gap-1.5 p-3" })}>
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
