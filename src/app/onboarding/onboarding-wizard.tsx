"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";
import { LEVELS, DAILY_GOALS } from "@/lib/onboarding-options";
import { completeOnboarding, type OnboardingState } from "./actions";

const STEP_COUNT = 6;

function LanguagePicker({
  value,
  onChange,
  exclude,
}: {
  value: string;
  onChange: (code: string) => void;
  exclude?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LANGUAGES.filter((l) => l.code !== exclude).filter(
      (l) => !q || l.name.toLowerCase().includes(q),
    );
  }, [query, exclude]);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Поиск языка…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
        {filtered.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange(l.code)}
            className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
              value === l.code
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [targetLanguage, setTargetLanguage] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [dailyWordGoal, setDailyWordGoal] = useState(10);

  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );

  const canAdvance = [
    true,
    !!targetLanguage,
    !!nativeLanguage,
    !!level,
    !!dailyWordGoal,
  ][step];

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
      <div className="mb-8 flex gap-1.5">
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${
              i <= step ? "bg-black dark:bg-white" : "bg-black/10 dark:bg-white/15"
            }`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="flex flex-1 flex-col justify-center gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Учи язык, читая то, что интересно
          </h1>
          <p className="text-black/60 dark:text-white/60">
            Никаких упражнений и геймификации. Читай реальные тексты, сохраняй
            незнакомые слова одним тапом и повторяй их по расписанию.
          </p>
          <Link href="/login" className="text-sm text-black/50 underline dark:text-white/50">
            Уже есть аккаунт? Войти
          </Link>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Какой язык учишь?</h2>
          <LanguagePicker value={targetLanguage} onChange={setTargetLanguage} />
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Какой у тебя родной язык?</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Будем переводить на него.
          </p>
          <LanguagePicker
            value={nativeLanguage}
            onChange={setNativeLanguage}
            exclude={targetLanguage}
          />
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Твой текущий уровень?</h2>
          <div className="flex flex-col gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  level === l.value
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Сколько слов в день хочешь учить?</h2>
          <div className="grid grid-cols-4 gap-2">
            {DAILY_GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setDailyWordGoal(g)}
                className={`rounded-lg border py-4 text-center text-lg font-medium transition-colors ${
                  dailyWordGoal === g
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <p className="text-sm text-black/60 dark:text-white/60">
            При {dailyWordGoal} словах в день — это {dailyWordGoal * 30} слов в месяц.
          </p>
        </div>
      )}

      {step === 5 && (
        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Создай аккаунт</h2>
          <input type="hidden" name="targetLanguage" value={targetLanguage} />
          <input type="hidden" name="nativeLanguage" value={nativeLanguage} />
          <input type="hidden" name="level" value={level} />
          <input type="hidden" name="dailyWordGoal" value={dailyWordGoal} />

          <input
            type="email"
            name="email"
            required
            placeholder="Email"
            className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
          />
          <input
            type="password"
            name="password"
            required
            minLength={6}
            placeholder="Пароль (мин. 6 символов)"
            className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
          />

          {state.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            {pending ? "Создаём…" : "Создать аккаунт и начать"}
          </button>
        </form>
      )}

      {step < 5 && (
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-full border border-black/10 px-5 py-3 font-medium transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              Назад
            </button>
          )}
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
          >
            Далее
          </button>
        </div>
      )}
    </div>
  );
}
