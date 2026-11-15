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
        {/* Эталон: docs/moments/mockups/Quit-confirm.dc.html — грустный маскот со слезой. */}
        <div style={{ display: "flex", justifyContent: "center", position: "relative", marginBottom: 14 }} aria-hidden="true">
          <div className="qc-droop">
            <svg viewBox="0 0 128 150" width="96" height="112">
              <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
              <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
              <path d="M49 58l8 3M71 58l-8 3" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="54" cy="65" rx="3" ry="4" fill="var(--leaf-edge)" />
              <ellipse cx="66" cy="65" rx="3" ry="4" fill="var(--leaf-edge)" />
              <path d="M54 77q6-5 12 0" fill="none" stroke="var(--leaf-edge)" strokeWidth="2.4" strokeLinecap="round" />
              <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            </svg>
          </div>
          <svg className="qc-tear" viewBox="0 0 10 14" width="10" height="14" style={{ position: "absolute", left: "50%", top: 40, marginLeft: -18 }}>
            <path d="M5 0C6 4 9 6 9 9a4 4 0 0 1-8 0c0-3 3-5 4-9z" fill="var(--sky)" />
          </svg>
        </div>
        <h1 className="mo-disp" style={{ margin: 0, textAlign: "center", fontSize: 22, lineHeight: 1.2, fontWeight: 900 }}>
          Точно выйти?
        </h1>
        <p className="mo-muted" style={{ margin: "8px 0 0", textAlign: "center", fontSize: 15, lineHeight: 1.45 }}>
          Осталось {tasksLabel(remaining)}, меньше {estimateReviewMinutes(remaining)} мин
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, padding: "12px 16px", borderRadius: 18, background: "var(--background)" }}>
          <div style={{ position: "relative", width: 64, height: 64, flex: "none" }}>
            <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" style={{ transform: "rotate(-90deg)" }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--surface-muted)" strokeWidth="7" />
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="var(--ember)"
                strokeWidth="7"
                className="qc-ring"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <div className="mo-disp" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900 }}>
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
                  <div className="qc-lose" style={{ fontSize: 15, fontWeight: 600, marginTop: 6, color: "var(--text-secondary)", textDecoration: "line-through", textDecorationThickness: 2, ["--d" as string]: ".7s" }}>
                    Серия {combo} верных
                  </div>
                )}
                {perfectBonusAtRisk && (
                  <div className="qc-lose" style={{ fontSize: 15, fontWeight: 600, marginTop: 4, color: "var(--text-secondary)", textDecoration: "line-through", textDecorationThickness: 2, ["--d" as string]: ".85s" }}>
                    Бонус +{perfectBonusXp} XP за чистое занятие
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Прогресс по уже отвеченным карточкам сохранён.</div>
            )}
          </div>
        </div>

        <div className="qc-stay" style={{ marginTop: 20 }}>
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
