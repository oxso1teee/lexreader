"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LANGUAGES, READY_LANGUAGES } from "@/lib/languages";
import { GOALS } from "@/lib/onboarding/goals";
import { SELF_REPORT_LEVELS } from "@/lib/onboarding/self-report-levels";
import { completeOnboarding, type OnboardingState } from "./actions";
import { joinLanguageWaitlist, type WaitlistState } from "./waitlist-actions";
import RateLimitNotice from "@/components/rate-limit-notice";
import { track } from "@/lib/posthog-client";

const STEP_COUNT = 6;

// Раздел 5 промта 2026-07-30 (запуск): библиотека готова только для
// английского — вместо выбора языка без контента открываем лист ожидания.
function WaitlistLanguageCell({ code, name }: { code: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<WaitlistState, FormData>(
    joinLanguageWaitlist,
    {},
  );

  if (state.ok) {
    return (
      <div className="rounded-lg border border-black/10 px-4 py-3 text-left text-sm text-black/50 dark:border-white/15 dark:text-white/50">
        {name} — сообщим, когда будет готово ✓
      </div>
    );
  }

  if (open) {
    return (
      <form action={formAction} className="col-span-2 flex flex-col gap-2 rounded-lg border border-black/10 p-3 dark:border-white/15">
        <input type="hidden" name="language" value={code} />
        <p className="text-sm font-medium">{name} — оставь почту, сообщим, когда будет готово</p>
        <input
          type="email"
          name="email"
          required
          placeholder="Email"
          className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
        />
        {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/15"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Сохраняем…" : "Сообщить мне"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center justify-between rounded-lg border border-black/10 px-4 py-3 text-left text-sm text-black/50 transition-colors hover:border-black/30 dark:border-white/15 dark:text-white/50 dark:hover:border-white/40"
    >
      {name}
      <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide dark:bg-white/10">
        Скоро
      </span>
    </button>
  );
}

function LanguagePicker({
  value,
  onChange,
  exclude,
  restrictToReady,
}: {
  value: string;
  onChange: (code: string) => void;
  exclude?: string;
  restrictToReady?: boolean;
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
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-sm text-black/50 dark:text-white/50">
          Ничего не найдено — попробуй другой запрос.
        </p>
      ) : (
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
          {filtered.map((l) =>
            restrictToReady && !READY_LANGUAGES.includes(l.code) ? (
              <WaitlistLanguageCell key={l.code} code={l.code} name={l.name} />
            ) : (
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
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [selfReportedCefr, setSelfReportedCefr] = useState("");

  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {},
  );
  const [blocked, setBlocked] = useState(false);
  const [prevRetryAfterSeconds, setPrevRetryAfterSeconds] = useState(state.retryAfterSeconds);
  if (state.retryAfterSeconds !== prevRetryAfterSeconds) {
    setPrevRetryAfterSeconds(state.retryAfterSeconds);
    setBlocked(Boolean(state.retryAfterSeconds));
  }

  const canAdvance = [
    true,
    !!primaryGoal,
    !!targetLanguage,
    !!nativeLanguage,
    !!selfReportedCefr,
  ][step];

  // M3 Slice 9 — mounts exactly once, on first render of the pre-account
  // wizard (same "mount = start" proxy the old first-win flow used for
  // signup_completed, since there's no server-side profile row yet at
  // Welcome to attach a real event to).
  useEffect(() => {
    track("onboarding_started", {});
  }, []);

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
          <h2 className="text-xl font-semibold">Для чего тебе английский?</h2>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setPrimaryGoal(g.id);
                  track("onboarding_goal_selected", { goal: g.id });
                }}
                className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                  primaryGoal === g.id
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Какой язык учишь?</h2>
          <LanguagePicker
            value={targetLanguage}
            restrictToReady
            onChange={(code) => {
              setTargetLanguage(code);
              // Найдено при повторном аудите: следующий шаг (родной язык)
              // уже исключает targetLanguage из списка, но если пользователь
              // вернётся сюда и сменит целевой язык на тот, что уже выбран
              // как родной, коллизия обнаруживалась только на финальном
              // сабмите без автоперехода назад. Сбрасываем родной язык
              // сразу же, чтобы коллизия была невозможна.
              if (code === nativeLanguage) setNativeLanguage("");
            }}
          />
        </div>
      )}

      {step === 3 && (
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

      {step === 4 && (
        <div className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Какой у тебя уровень английского?</h2>
          <p className="text-sm text-black/60 dark:text-white/60">
            Это не экзамен — просто ориентир. Дальше уточним коротким тестом.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {SELF_REPORT_LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => {
                  setSelfReportedCefr(l.value);
                  track("onboarding_level_selected", { self_reported_cefr: l.value });
                }}
                className={`rounded-lg border px-4 py-3 text-center font-medium transition-colors ${
                  l.value === "unsure" ? "col-span-2" : ""
                } ${
                  selfReportedCefr === l.value
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

      {step === 5 && (
        <form action={formAction} className="flex flex-1 flex-col gap-4">
          <h2 className="text-xl font-semibold">Создай аккаунт</h2>
          <input type="hidden" name="primaryGoal" value={primaryGoal} />
          <input type="hidden" name="targetLanguage" value={targetLanguage} />
          <input type="hidden" name="nativeLanguage" value={nativeLanguage} />
          <input type="hidden" name="selfReportedCefr" value={selfReportedCefr} />

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

          {blocked && state.retryAfterSeconds ? (
            <RateLimitNotice
              key={state.retryAfterSeconds}
              message={state.error ?? "Слишком много попыток регистрации."}
              retryAfterSeconds={state.retryAfterSeconds}
              onExpire={() => setBlocked(false)}
            />
          ) : (
            state.error &&
            !state.retryAfterSeconds && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            )
          )}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="rounded-full border border-black/10 px-5 py-3 font-medium transition-colors hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            >
              Назад
            </button>
            <button
              type="submit"
              disabled={pending || blocked}
              className="flex-1 rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
              {pending ? "Создаём…" : "Создать аккаунт и начать"}
            </button>
          </div>
          <p className="text-center text-xs text-black/40 dark:text-white/40">
            Создавая аккаунт, ты соглашаешься с{" "}
            <Link href="/terms" className="underline">
              условиями использования
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="underline">
              политикой конфиденциальности
            </Link>
            .
          </p>
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
