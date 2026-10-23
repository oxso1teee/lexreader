"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { saveStreakGoalAction } from "./actions";
import { STREAK_COMMIT_TIERS } from "./tiers";

// Эталон: docs/moments/mockups/Streak-commit.dc.html. Огонь/угли —
// переиспользованные mo-flick/mo-em/mo-glow из moments.css (те же классы,
// что уже используются для Freeze-used, этап 2) — не новая анимация.
export default function StreakCommitClient() {
  const [i, setI] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tier = STREAK_COMMIT_TIERS[i];
  const flameSize = [92, 108, 124, 140][i];
  const emberCount = 4 + i * 3;

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await saveStreakGoalAction(tier.days);
      } catch {
        setError("Не удалось сохранить цель. Попробуй ещё раз.");
      }
    });
  }

  return (
    <div className="onb-screen relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-14">
      <div className="flex items-center gap-2">
        <Link href="/onboarding/goal" aria-label="Назад" className="focus-ring flex h-11 w-11 items-center justify-center text-[var(--text-secondary)]">
          <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
            <path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="progressbar" aria-label="Шаг 2 из 3" aria-valuemin={0} aria-valuemax={3} aria-valuenow={2}>
          <div className="h-full rounded-full" style={{ width: "66%", background: "var(--leaf)", boxShadow: "inset 0 -4px 0 0 var(--leaf-edge)" }} />
        </div>
      </div>

      <div className="mt-3.5 text-center">
        <div className="relative mx-auto flex h-[150px] w-[180px] items-end justify-center">
          {Array.from({ length: emberCount }).map((_, k) => {
            let s = 9 + k * 7 + i * 31;
            const r = () => {
              s = (s * 9301 + 49297) % 233280;
              return s / 233280;
            };
            const dx = Math.round(r() * 90 - 45);
            const t = (1.4 + r()).toFixed(2);
            const d = (-r() * 2).toFixed(2);
            return (
              <span
                key={k}
                className="mo-em"
                aria-hidden="true"
                style={{ background: "var(--sun)", marginLeft: `${Math.round(r() * 40 - 24)}px`, "--dx": `${dx}px`, "--t": `${t}s`, "--d": `${d}s` } as React.CSSProperties}
              />
            );
          })}
          <div className="mo-flick">
            <svg viewBox="0 0 24 24" width={flameSize} height={flameSize} aria-hidden="true" style={{ display: "block" }}>
              <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
              <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
            </svg>
          </div>
        </div>
        <h1 className="mo-disp mo-rise mt-1.5 text-[23px] font-black leading-tight">Сколько дней подряд берёшь на себя?</h1>
        <p className="mo-rise mt-2 text-sm text-[var(--text-secondary)]" style={{ animationDelay: "0.1s" }}>
          Кто ставит цель, занимается в 3 раза чаще
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Цель стрика">
        {STREAK_COMMIT_TIERS.map((t, k) => {
          const on = k === i;
          return (
            <button
              key={t.days}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setI(k)}
              className="mo-rise relative flex flex-col items-start gap-1 rounded-2xl border-2 px-3.5 py-3.5 text-left"
              style={{
                animationDelay: `${(0.1 + k * 0.06).toFixed(2)}s`,
                borderColor: on ? "var(--ember)" : "var(--border-strong)",
                background: on ? "var(--ember-tint)" : "var(--surface)",
                color: on ? "var(--ember-text)" : "var(--foreground)",
                boxShadow: `inset 0 -5px 0 0 ${on ? "var(--ember)" : "rgba(26,26,26,.08)"}`,
              }}
            >
              {on && (
                <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--ember-text)" }}>
                  <svg viewBox="0 0 24 24" width={14} height={14} aria-hidden="true">
                    <path d="M5 12l5 5L20 7" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <span className="mo-disp text-[32px] font-black leading-none">{t.days}</span>
              <span className="text-sm font-bold">дней · {t.word}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3.5 rounded-2xl border-2 border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
        <div className="flex justify-between text-sm font-bold">
          <span>Твоя серия</span>
          <span style={{ color: "var(--ember-text)" }}>{tier.days} дней</span>
        </div>
        {/* Точки — дни выбранной цели; каждый 7-й темнее (неделя). */}
        <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: "repeat(25, minmax(0, 1fr))" }} aria-hidden="true">
          {Array.from({ length: 50 }, (_, k) => (
            <span
              key={k}
              className="aspect-square rounded-full"
              style={{
                background: k < tier.days ? (k % 7 === 6 ? "var(--ember-text)" : "var(--ember)") : "var(--surface-muted)",
                transition: "background .25s",
                transitionDelay: `${(k * 0.012).toFixed(3)}s`,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-secondary)]">
          <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="var(--sky-text)" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9" />
          </svg>
          {tier.reward}
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
          style={{ background: "var(--ember-text)", boxShadow: "inset 0 -4px 0 0 #9a330a" }}
        >
          {pending ? "…" : `Беру обязательство: ${tier.days} дней`}
        </button>
      </div>
    </div>
  );
}
