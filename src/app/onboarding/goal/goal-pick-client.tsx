"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GOAL_TIERS, saveGoalAction } from "./actions";

// Эталон: docs/moments/mockups/Goal-pick.dc.html. Прогноз "слов за месяц" —
// оценка (~25 слов в книгах на минуту чтения в месяц, калибровано по
// порядку величины макета), не сохраняется и не выдаётся где-либо ещё как
// факт — явно подписана как прогноз, а не измеренное число.
const WORDS_PER_MINUTE_PER_MONTH = 25;

export default function GoalPickClient({ initialXpGoal }: { initialXpGoal: number }) {
  const initialIndex = Math.max(0, GOAL_TIERS.findIndex((t) => t.xp === initialXpGoal));
  const [i, setI] = useState(initialIndex === -1 ? 1 : initialIndex);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tier = GOAL_TIERS[i];
  const wordsPerMonth = tier.minutes * WORDS_PER_MINUTE_PER_MONTH;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await saveGoalAction(tier.minutes);
      } catch {
        setError("Не удалось сохранить цель. Попробуй ещё раз.");
      }
    });
  }

  return (
    <div className="onb-screen relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-14">
      <div className="flex items-center gap-2">
        <Link href="/onboarding/result" aria-label="Назад" className="focus-ring flex h-11 w-11 items-center justify-center text-[var(--text-secondary)]">
          <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
            <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--border)]" role="progressbar" aria-label="Шаг 1 из 3" aria-valuemin={0} aria-valuemax={3} aria-valuenow={1}>
          <div className="h-full rounded-full" style={{ width: "33%", background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }} />
        </div>
      </div>

      <div className="mt-5 flex items-end gap-2.5">
        <div className="mo-breathe flex-none">
          <svg viewBox="0 0 128 150" width={84} height={98} aria-hidden="true">
            <path d="M64 8C78 26 100 44 92 72C87 92 66 104 48 90C32 78 32 54 48 40C58 31 60 20 64 8Z" fill="var(--leaf)" />
            <path d="M60 46C70 58 76 68 68 82C63 90 50 90 44 81C39 73 43 61 51 53C55 50 57 48 60 46Z" fill="var(--leaf-tint)" opacity="0.9" />
            <ellipse cx="54" cy="62" rx="3.2" ry="4.4" fill="var(--leaf-deep)" />
            <ellipse cx="66" cy="62" rx="3.2" ry="4.4" fill="var(--leaf-deep)" />
            <path d="M54 72q6 5 12 0" fill="none" stroke="var(--leaf-deep)" strokeWidth={2.4} strokeLinecap="round" />
            <ellipse cx="90" cy="100" rx="19" ry="12" fill="var(--ember)" transform="rotate(-28 90 100)" />
            <ellipse cx="94" cy="96" rx="8" ry="5" fill="var(--sun)" transform="rotate(-28 94 96)" opacity="0.85" />
          </svg>
        </div>
        <div className="mo-pop relative mb-8 flex-1 rounded-2xl rounded-bl-md border-2 border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
          <h1 className="text-lg font-bold leading-snug">Сколько минут в день готов читать?</h1>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2.5" role="radiogroup" aria-label="Цель дня">
        {GOAL_TIERS.map((t, k) => {
          const on = k === i;
          return (
            <button
              key={t.minutes}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setI(k)}
              className="mo-rise flex items-center gap-3.5 rounded-2xl border-2 px-4 py-3.5 text-left font-bold transition-colors"
              style={{
                animationDelay: `${(0.1 + k * 0.06).toFixed(2)}s`,
                background: on ? "var(--leaf-tint)" : "var(--surface)",
                borderColor: on ? "var(--leaf)" : "var(--border)",
                color: on ? "var(--leaf-deep)" : "var(--text-primary)",
                boxShadow: `inset 0 -4px 0 0 ${on ? "var(--leaf)" : "var(--border)"}`,
              }}
            >
              <span
                className="flex h-[46px] w-[62px] flex-none flex-col items-center justify-center rounded-xl"
                style={{ background: on ? "var(--leaf)" : "var(--surface-muted)", color: on ? "#fff" : "var(--text-primary)" }}
              >
                <span className="text-lg font-black leading-none">{t.minutes}</span>
                <span className="mt-0.5 text-[11px] font-bold">мин</span>
              </span>
              <span className="flex-1">
                {t.label}
                <span className="mt-0.5 block text-sm font-semibold opacity-70">{t.sub}</span>
              </span>
              <span
                className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-2"
                style={{ borderColor: on ? "var(--leaf)" : "var(--border-strong)", background: on ? "var(--leaf)" : "transparent" }}
              >
                {on && (
                  <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true">
                    <path d="M5 12l5 5L20 7" fill="none" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3.5 rounded-2xl p-3.5" style={{ background: "var(--leaf-tint)" }} aria-live="polite">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-xl" style={{ background: "var(--leaf)" }}>
          <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
            <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2z" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: "var(--leaf-text)" }}>
            Через месяц это примерно
          </div>
          <div className="mt-0.5 text-lg font-black" style={{ color: "var(--leaf-deep)" }}>
            {wordsPerMonth} новых слов
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--color-danger-text)]">
          {error}
        </p>
      )}

      <div className="mt-auto pt-6">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="focus-ring flex min-h-[54px] w-full items-center justify-center rounded-2xl px-5 font-bold text-white disabled:opacity-60"
          style={{ background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }}
        >
          {pending ? "…" : `Продолжить · ${tier.minutes} мин в день`}
        </button>
      </div>
    </div>
  );
}
