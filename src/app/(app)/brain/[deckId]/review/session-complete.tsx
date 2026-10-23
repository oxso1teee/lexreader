"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Trophy } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getLanguageTwinUpdateAction, type LanguageTwinSessionUpdate } from "./actions";
import { completeMissionAction } from "@/app/(app)/missions/actions";
import { track } from "@/lib/posthog-client";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import type { PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";
import { cardClassName } from "@/components/ui/card";
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

// Искры вокруг маскота (макет: .sp с --dx/--dy).
const SPARKS: CSSProperties[] = [
  ["var(--sun)", -120, -80, 0],
  ["var(--sky)", 120, -70, 0.2],
  ["var(--ember)", -100, 60, 0.4],
  ["var(--leaf)", 110, 70, 0.6],
  ["var(--danger)", 0, -120, 0.8],
  ["var(--sun)", -40, 110, 1],
].map(([bg, dx, dy, d]) => ({ background: bg as string, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animationDelay: `${d}s` }) as CSSProperties);

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
    // Эталон: docs/moments/mockups/Result.dc.html.
    <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col" style={{ paddingBottom: 120 }}>
      <div style={{ position: "relative", height: 270, marginTop: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {SPARKS.map((sp, i) => (
          <span key={i} className="rs-sp" style={sp} aria-hidden="true" />
        ))}
        <div className="mo-rise">
          <div className="rs-bob">
            <svg viewBox="0 0 128 150" width="170" height="200" aria-hidden="true">
              <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
              <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
            </svg>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "0 24px" }}>
        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="mo-disp"
          style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 900, color: "var(--sun-text)" }}
        >
          Занятие завершено!
        </motion.h1>
        <p className="mo-muted" style={{ margin: "8px 0 0", fontSize: 15 }}>
          {newWordsCount > 0 ? `${wordCountLabel(newWordsCount)} ушли в повторение` : `Ты повторил ${wordCountLabel(count)}`}
        </p>
        {newRecord && (
          <p className="mt-2 flex items-center justify-center gap-1.5 font-medium text-[var(--color-forest-text)]">
            <Trophy aria-hidden="true" className="h-4 w-4" />
            Новый личный рекорд сессии!
          </p>
        )}
      </div>

      {/* Три плитки реальной статистики сессии: Опыт (сумма addXp),
          Точность (из тэлли), Время (клиентский таймер review-session.tsx). */}
      <div style={{ display: "flex", gap: 10, padding: "24px 16px 0" }}>
        <div className="rs-stat" style={{ ["--c" as string]: "var(--sun)", ["--t" as string]: "#1a1a1a", ["--v" as string]: "var(--sun-text)" } as CSSProperties}>
          <div className="rs-stat-h">Опыт</div>
          <div className="rs-stat-v">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" fill="var(--sun)" stroke="var(--sun-edge)" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            {xpEarned}
          </div>
        </div>
        <div className="rs-stat" style={{ ["--c" as string]: "var(--leaf)", ["--t" as string]: "#fff", ["--v" as string]: "var(--leaf-text)" } as CSSProperties}>
          <div className="rs-stat-h">Точность</div>
          <div className="rs-stat-v">{accuracyPercent}%</div>
        </div>
        <div className="rs-stat" style={{ ["--c" as string]: "#0b79b0", ["--t" as string]: "#fff", ["--v" as string]: "var(--sky-text)" } as CSSProperties}>
          <div className="rs-stat-h">Время</div>
          <div className="rs-stat-v">{formatDuration(durationSec)}</div>
        </div>
      </div>

      {/* Только когда серия действительно выросла за эту сессию (streak_up
          среди собранных moments). */}
      {streakUpMoment && (
        <div className="mo-card" style={{ margin: "14px 16px 0", padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, background: "var(--ember-tint)", borderColor: "var(--ember)" }}>
          <div className="rs-flick" style={{ flex: "none" }}>
            <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
              <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
            </svg>
          </div>
          <div>
            <div className="mo-disp" style={{ fontSize: 18, fontWeight: 700, color: "var(--ember-text)" }}>
              {streakUpMoment.streak} {daysWord(streakUpMoment.streak)} подряд
            </div>
            <div style={{ fontSize: 14, color: "var(--ember-text)", marginTop: 2 }}>
              {streakLongest > streakUpMoment.streak
                ? `Стрик продлён. До рекорда ${streakLongest - streakUpMoment.streak} ${daysWord(streakLongest - streakUpMoment.streak)}`
                : "Стрик продлён. Новый личный рекорд!"}
            </div>
          </div>
        </div>
      )}

      {twinUpdate && (
        <div className={cardClassName({ className: "mx-4 mt-3.5 flex flex-col items-center gap-1.5 p-3 text-center" })}>
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
        <Link href={`/missions/${missionId}`} className="mo-link2">
          Посмотреть результат миссии
        </Link>
      )}

      {/* "Продолжить": собранные за сессию moments уходят в общую очередь
          (MomentProvider, корневой layout) прямо здесь, до навигации —
          очередь переживает переход на /brain и доигрывает Perfect/
          Goal-done/Streak-up/... поверх уже открытого /brain. */}
      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md px-5 pb-[calc(34px+env(safe-area-inset-bottom))] pt-[18px]" style={{ background: "var(--background)" }}>
        <ButtonLink href="/brain" onClick={() => pushMoments(queuedMoments)} className="mo-cta">
          Продолжить
        </ButtonLink>
      </div>
    </div>
  );
}
