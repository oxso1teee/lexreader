"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Flame, Trophy, Zap } from "lucide-react";
import { getLanguageTwinUpdateAction, type LanguageTwinSessionUpdate } from "./actions";
import { completeMissionAction } from "@/app/(app)/missions/actions";
import { track } from "@/lib/posthog-client";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import type { PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";
import { cardClassName } from "@/components/ui/card";
import { ReadingCompanion } from "@/components/product/mascot/reading-companion";
import { useMoments } from "@/components/product/moments/moment-provider";
import type { Moment } from "@/lib/moments/types";

// docs/moments/mockups/Result.dc.html — итог занятия, этап 1
// (docs/moments/ROADMAP.md). Порядок показа после занятия: Result (этот
// экран) → Perfect → Goal-done → Streak-up → Level-up/Achievement →
// Word-mastered — остальные экраны приходят через queuedMoments и
// показываются MomentProvider'ом после нажатия кнопки ниже.

function wordCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word: string;
  if (mod10 === 1 && mod100 !== 11) word = "слово";
  else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) word = "слова";
  else word = "слов";
  return `${count} ${word}`;
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionComplete({
  count,
  newRecord = false,
  missionId = null,
  missionCorrectCount = 0,
  missionIncorrectCount = 0,
  cards = [],
  xpEarned = 0,
  newWordsCount = 0,
  durationSec = 0,
  streakLongest = 0,
  queuedMoments = [],
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
  /** Сумма реально начисленного addXp() за сессию (review-session.tsx). */
  xpEarned?: number;
  /** Карточек, пройденных в первый раз (wasNew), за эту сессию. */
  newWordsCount?: number;
  durationSec?: number;
  streakLongest?: number;
  /** Собранные за сессию moments (reviewWord + бонус за Perfect) — этот
   *  экран их только передаёт в очередь по кнопке, сам не решает, что было. */
  queuedMoments?: Moment[];
}) {
  const [twinUpdate, setTwinUpdate] = useState<LanguageTwinSessionUpdate | null>(null);
  const [missionDone, setMissionDone] = useState(false);
  const reduceMotion = useReducedMotion();
  const { pushMoments } = useMoments();

  useEffect(() => {
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

  const totalGraded = missionCorrectCount + missionIncorrectCount;
  const accuracyPercent = totalGraded > 0 ? Math.round((missionCorrectCount / totalGraded) * 100) : 100;
  const streakUpMoment = queuedMoments.find((m): m is Moment & { kind: "streak_up" } => m.kind === "streak_up");

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <div style={{ marginTop: -24 }}>
        <ReadingCompanion size={120} withHalo={false} autoExcite={!reduceMotion} />
      </div>
      <motion.h1
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className="font-display text-[22px] font-bold text-[var(--sun-text)]"
      >
        Занятие завершено!
      </motion.h1>
      <p className="text-[13px] text-[var(--text-secondary)]">
        {newWordsCount > 0
          ? `${wordCountLabel(newWordsCount)} ушли в повторение`
          : `Ты повторил ${wordCountLabel(count)}`}
      </p>
      {newRecord && (
        <p className="flex items-center gap-1.5 font-medium text-[var(--color-forest-text)]">
          <Trophy aria-hidden="true" className="h-4 w-4" />
          Новый личный рекорд сессии!
        </p>
      )}

      {/* docs/moments/mockups/Result.dc.html — три плитки реальной статистики
          сессии: Опыт (сумма addXp), Точность (из тэлли), Время (клиентский
          таймер review-session.tsx). */}
      <div className="mt-1 grid w-full max-w-sm grid-cols-3 gap-2">
        <div className="overflow-hidden rounded-2xl border-2 border-[var(--sun)] bg-[var(--surface)] text-center">
          <div className="bg-[var(--sun)] py-1.5 text-[11px] font-bold tracking-wide text-foreground uppercase">Опыт</div>
          <div className="flex items-center justify-center gap-1 py-3 font-display text-lg font-bold text-[var(--sun-text)]">
            <Zap aria-hidden="true" className="h-4 w-4" />
            {xpEarned}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border-2 border-[var(--leaf)] bg-[var(--surface)] text-center">
          <div className="bg-[var(--leaf)] py-1.5 text-[11px] font-bold tracking-wide text-white uppercase">Точность</div>
          <div className="py-3 font-display text-lg font-bold text-[var(--color-forest-text)]">{accuracyPercent}%</div>
        </div>
        <div className="overflow-hidden rounded-2xl border-2 border-[var(--sky)] bg-[var(--surface)] text-center">
          <div className="bg-[var(--sky)] py-1.5 text-[11px] font-bold tracking-wide text-white uppercase">Время</div>
          <div className="py-3 font-display text-lg font-bold text-[var(--sky-text)]">{formatDuration(durationSec)}</div>
        </div>
      </div>

      {/* Только когда серия действительно выросла за эту сессию (streak_up
          среди собранных moments) — не декоративная карточка "на всякий
          случай", как и остальные условные блоки на этом экране. */}
      {streakUpMoment && (
        <div
          className={cardClassName({
            className: "mt-1 flex w-full max-w-sm items-center gap-3 p-3 text-left",
          })}
          style={{ background: "var(--ember-tint)", borderColor: "var(--ember)" }}
        >
          <Flame aria-hidden="true" className="h-9 w-9 flex-none text-[var(--ember)]" />
          <div>
            <p className="font-display text-base font-bold text-[var(--ember-text)]">
              {streakUpMoment.streak} {daysWord(streakUpMoment.streak)} подряд
            </p>
            <p className="text-sm text-[var(--ember-text)]">
              {streakLongest > streakUpMoment.streak
                ? `Стрик продлён. До рекорда ${streakLongest - streakUpMoment.streak} ${daysWord(streakLongest - streakUpMoment.streak)}`
                : "Стрик продлён. Новый личный рекорд!"}
            </p>
          </div>
        </div>
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
          <p className="text-xs text-[var(--text-secondary)]">{twinUpdate.patternTitle}</p>
        </div>
      )}
      {missionId && missionDone && (
        <Link
          href={`/missions/${missionId}`}
          className="mt-2 rounded-full border border-[var(--border-strong)] px-5 py-3 font-medium text-[var(--text-secondary)] hover:border-[var(--sky)]"
        >
          Посмотреть результат миссии →
        </Link>
      )}
      {/* docs/moments/mockups/Result.dc.html — "Продолжить": собранные за
          сессию moments уходят в общую очередь (MomentProvider, корневой
          layout) прямо здесь, до навигации — очередь переживает переход на
          /brain (портал рендерится на уровне layout, не этой страницы) и
          доигрывает Perfect/Goal-done/Streak-up/... поверх уже открытого
          /brain, как и задумано порядком показа в ROADMAP.md. */}
      <Link
        href="/brain"
        onClick={() => pushMoments(queuedMoments)}
        className="mt-4 rounded-full bg-[var(--color-forest)] px-5 py-3 font-medium text-white"
      >
        Продолжить
      </Link>
    </div>
  );
}
