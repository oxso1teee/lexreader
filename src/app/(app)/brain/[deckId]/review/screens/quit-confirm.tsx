"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { estimateReviewMinutes } from "@/lib/brain-stats";

// Тот же 3-формный русский plural, что у wordCountLabel в session-
// complete.tsx — бинарный "N===1 ? X : Y" даёт неверную форму при N=2-4.
function tasksLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} задание`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${n} задания`;
  return `${n} заданий`;
}

// docs/moments/mockups/Quit-confirm.dc.html, reference/Quit-confirm.png.
// Макет обещает "пропадёт +45 XP" — неправда для этого приложения: XP
// начисляется по каждой карточке сразу (reviewWord -> addXp), уже реально
// сохранён в profiles.xp, выход из сессии его не отбирает. Честные вещи,
// которые ДЕЙСТВИТЕЛЬНО теряются при выходе: текущая серия верных подряд
// (комбо — только в памяти клиента, не переживает выход/перезагрузку) и
// шанс на бонус +10 XP за чистое занятие (awardPerfectBonus — начисляется
// только при полном завершении без ошибок, см. review/actions.ts).
export function QuitConfirmSheet({
  cardsDone,
  cardsTotal,
  combo,
  perfectBonusAtRisk,
  perfectBonusXp,
  onStay,
  onLeave,
}: {
  cardsDone: number;
  cardsTotal: number;
  combo: number;
  perfectBonusAtRisk: boolean;
  perfectBonusXp: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const remaining = cardsTotal - cardsDone;
  const circumference = 2 * Math.PI * 28;
  const progress = cardsTotal > 0 ? cardsDone / cardsTotal : 0;

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>("button")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onStay();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [onStay]);

  const hasLosses = combo > 0 || perfectBonusAtRisk;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55"
      onClick={onStay}
      style={{ animation: "mo-rise 0.25s ease-out both" }}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Точно выйти из занятия?"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[30px] px-5 pb-[calc(34px+env(safe-area-inset-bottom))] pt-3"
        style={{ background: "var(--surface)" }}
      >
        <div style={{ width: 44, height: 5, borderRadius: 99, background: "var(--border-strong)", margin: "0 auto 16px" }} />
        <h1 className="mo-disp" style={{ margin: 0, textAlign: "center", fontSize: 22, lineHeight: 1.2, fontWeight: 900 }}>
          Точно выйти?
        </h1>
        <p className="mo-muted" style={{ margin: "8px 0 0", textAlign: "center", fontSize: 15, lineHeight: 1.45 }}>
          Осталось {tasksLabel(remaining)}, меньше {estimateReviewMinutes(remaining)} мин
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, padding: "12px 16px", borderRadius: 18, background: "var(--background)" }}>
          <div style={{ position: "relative", width: 56, height: 56, flex: "none" }}>
            <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--border)" strokeWidth="7" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="var(--sun)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <div className="mo-disp" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900 }}>
              {cardsDone}/{cardsTotal}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {hasLosses ? (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-danger-text)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Если выйдешь, пропадёт
                </div>
                {combo > 0 && (
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: "var(--text-secondary)", textDecoration: "line-through" }}>
                    Серия {combo} верных
                  </div>
                )}
                {perfectBonusAtRisk && (
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: "var(--text-secondary)", textDecoration: "line-through" }}>
                    Бонус +{perfectBonusXp} XP за чистое занятие
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Прогресс по уже отвеченным карточкам сохранён.</div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <Button variant="leaf" className="mo-cta" onClick={onStay}>
            Остаться и закончить
          </Button>
        </div>
        <button
          type="button"
          onClick={onLeave}
          style={{ display: "block", width: "100%", textAlign: "center", font: "700 16px/1 var(--font-onest), sans-serif", color: "var(--color-danger-text)", padding: "18px 0 4px", background: "none", border: 0 }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
}
