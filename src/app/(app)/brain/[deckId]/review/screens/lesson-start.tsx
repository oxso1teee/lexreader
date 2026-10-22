"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { MomentScreen } from "@/components/product/moments/moment-screen";
import { estimateReviewMinutes } from "@/lib/brain-stats";

// docs/moments/mockups/Lesson-start.dc.html, reference/Lesson-start.png.
// Отличия от макета (осознанные, не ошибка пиксель-сверки): нет "Раздел 2 ·
// Занятие 4" и названия главы — колоды не организованы в разделы/главы (это
// нереализованная механика "собранного занятия", этап 8), так что вместо
// выдуманного текста здесь честное sessionTitle (имя колоды или
// "Повторение" для кросс-дековой сессии). Листья/книжка — то же SVG, что и
// в макете (чисто декоративная иллюстрация, не завязана на данные).
// MomentScreen: Esc закрывает так же, как × — обе ведут на /brain, ещё
// ничего не начато, терять нечего.
// Тот же 3-формный русский plural, что уже есть у wordCountLabel/daysWord в
// session-complete.tsx (не экспортированы отсюда — свой маленький хелпер,
// а не копия "минута/минуты" в два варианта, которая давала "5 минуты").
function minutesLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word: string;
  if (mod10 === 1 && mod100 !== 11) word = "минута";
  else if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) word = "минуты";
  else word = "минут";
  return `${n} ${word}`;
}

const STEPS_TOTAL_MS = 1500;
const STEP_MARKS = [500, 1000, STEPS_TOTAL_MS] as const;
const STEP_LABELS = ["Готовим слова", "Добавляем повторы", "Собираем занятие"] as const;

export function LessonStartScreen({
  sessionTitle,
  newCardsCount,
  reviewCardsCount,
  onReady,
}: {
  sessionTitle: string;
  newCardsCount: number;
  reviewCardsCount: number;
  onReady: () => void;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const totalCount = newCardsCount + reviewCardsCount;
  const [elapsed, setElapsed] = useState(reduceMotion ? STEPS_TOTAL_MS : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const el = Date.now() - t0;
      setElapsed(el);
      if (el >= STEPS_TOTAL_MS) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [reduceMotion]);

  const ready = elapsed >= STEPS_TOTAL_MS;

  return (
    <MomentScreen
      title="Старт занятия"
      haptic={null}
      footerDelay={0}
      onClose={() => router.push("/brain")}
      footer={
        ready ? (
          <Button variant="leaf" className="mo-cta" onClick={onReady}>
            Поехали
          </Button>
        ) : (
          <div
            className="mo-cta"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, background: "var(--border)", color: "var(--text-secondary)", fontWeight: 700 }}
            aria-hidden="true"
          >
            {Math.min(100, Math.round((elapsed / STEPS_TOTAL_MS) * 100))}%
          </div>
        )
      }
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 20px 0" }}>
        <button
          type="button"
          onClick={() => router.push("/brain")}
          aria-label="Закрыть"
          style={{ width: 44, height: 44, marginLeft: -10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", background: "none", border: 0 }}
        >
          <X aria-hidden="true" style={{ width: 26, height: 26 }} />
        </button>
      </div>

      <div style={{ textAlign: "center", paddingTop: 24 }}>
        <svg viewBox="0 0 128 150" width="96" height="112" aria-hidden="true" style={{ display: "block", margin: "0 auto" }}>
          <ellipse cx="64" cy="128" rx="34" ry="9" fill="rgba(0,0,0,0.06)" />
          <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
          <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
        </svg>
        <h1 className="mo-disp" style={{ margin: "14px 24px 0", fontSize: 21, lineHeight: 1.2, fontWeight: 900 }}>
          {sessionTitle}
        </h1>
        <p className="mo-muted" style={{ margin: "6px 0 0", fontSize: 15 }}>
          ≈ {minutesLabel(estimateReviewMinutes(totalCount))} · можно прервать в любой момент
        </p>
      </div>

      <div className="mo-rise" style={{ display: "flex", gap: 8, margin: "18px 20px 0" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, padding: "10px 4px", borderRadius: 14, background: "var(--sun-tint)", color: "var(--sun-text)" }}>
          <span className="mo-disp" style={{ fontSize: 20, fontWeight: 900 }}>{newCardsCount}</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>новых слов</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, padding: "10px 4px", borderRadius: 14, background: "var(--sky-tint)", color: "var(--sky-text)" }}>
          <span className="mo-disp" style={{ fontSize: 20, fontWeight: 900 }}>{reviewCardsCount}</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>на повтор</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, padding: "10px 4px", borderRadius: 14, background: "var(--leaf-tint)", color: "var(--leaf-text)" }}>
          <span className="mo-disp" style={{ fontSize: 20, fontWeight: 900 }}>{totalCount}</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>заданий</span>
        </div>
      </div>

      <div className="mo-rise mo-card" style={{ margin: "14px 20px 0", padding: "4px 16px" }} aria-live="polite">
        {STEP_LABELS.map((label, i) => {
          const done = elapsed >= STEP_MARKS[i];
          const busy = !done && (i === 0 || elapsed >= STEP_MARKS[i - 1]);
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                fontSize: 15,
                fontWeight: 600,
                borderBottom: i < STEP_LABELS.length - 1 ? "2px solid var(--border)" : undefined,
                color: done || busy ? "var(--foreground)" : "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  background: done ? "var(--leaf)" : busy ? "var(--leaf-tint)" : "var(--border)",
                }}
              >
                {done && (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M5 12l5 5L20 7" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {busy && !done && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 18,
                      height: 18,
                      border: "2px solid var(--leaf)",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: reduceMotion ? undefined : "mo-spin 0.8s linear infinite",
                    }}
                  />
                )}
              </span>
              {label}
            </div>
          );
        })}
      </div>

      <div className="mo-rise" style={{ margin: "14px 20px 0", padding: "12px 14px", borderRadius: 18, background: "var(--sun-tint)", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" style={{ color: "var(--sun-text)", flex: "none" }}>
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ fontSize: 14, lineHeight: 1.45, color: "var(--sun-text)" }}>
          <b>Совет.</b> Нажми на колонку со звуком 🔊, чтобы услышать произношение слова.
        </div>
      </div>
    </MomentScreen>
  );
}
