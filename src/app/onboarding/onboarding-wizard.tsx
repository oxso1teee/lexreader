"use client";

import {
  BookOpen,
  Briefcase,
  Compass,
  GraduationCap,
  House,
  Mail,
  MessagesSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AuthBody, AuthDock } from "@/components/product/auth/auth-screen";
import { PasswordField } from "@/components/product/auth/password-field";
import { LanguagePicker } from "@/components/product/onboarding/language-picker";
import { SplashScreen } from "@/components/product/onboarding/splash-screen";
import { LexSay, StepShell } from "@/components/product/onboarding/step-shell";
import RateLimitNotice from "@/components/rate-limit-notice";
import { Alert, Button, ChoiceGroup, Input, type ChoiceTone } from "@/components/ui";
import { GOALS, type GoalId } from "@/lib/onboarding/goals";
import { SELF_REPORT_LEVELS } from "@/lib/onboarding/self-report-levels";
import type { SelfReportedCefr } from "@/lib/placement/types";
import { track } from "@/lib/posthog-client";
import { useRetryBlock } from "@/lib/ui/use-retry-block";
import { completeOnboarding, type OnboardingState } from "./actions";

// Визард до создания аккаунта: Splash (шаг 0, экран «моментов») → цель →
// изучаемый язык → родной язык → уровень → аккаунт. Шаги 1–5 в каркасе макетов
// Onboarding-why / Placement-question: полоса прогресса «Шаг N из 5», Lex со
// словами, карточки выбора, закреплённая кнопка «Далее». Логика шагов, аналитика
// и completeOnboarding — прежние.
const TOTAL_STEPS = 5;

// Иконка и подпись у цели — оформление реальных вариантов GOALS (id и label
// остаются источником правды), а не новые данные.
const GOAL_VISUALS: Record<GoalId, { icon: LucideIcon; tone: ChoiceTone; description: string }> = {
  everyday: { icon: House, tone: "leaf", description: "Повседневные тексты и слова" },
  travel: { icon: Compass, tone: "sun", description: "Отели, кафе, дорога" },
  work_it: { icon: Briefcase, tone: "sky", description: "Письма, документация, созвоны" },
  study: { icon: GraduationCap, tone: "ember", description: "Статьи, учебники, экзамены" },
  friends_international: { icon: MessagesSquare, tone: "leaf", description: "Друзья и знакомые из других стран" },
  reading_content: { icon: BookOpen, tone: "sky", description: "Книги, статьи и видео в оригинале" },
  general: { icon: Sparkles, tone: "neutral", description: "Без конкретной цели" },
};

const LEVEL_HINTS: Record<SelfReportedCefr, string> = {
  A1: "Знаю отдельные слова и фразы",
  A2: "Понимаю простые тексты и фразы",
  B1: "Читаю несложные тексты без перевода",
  B2: "Свободно читаю оригиналы",
  unsure: "Определим коротким тестом",
};

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [selfReportedCefr, setSelfReportedCefr] = useState("");
  // Управляемое поле: React 19 сбрасывает неуправляемые поля формы после
  // каждого server action, и после ошибки email пришлось бы вводить заново.
  const [email, setEmail] = useState("");

  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});
  const [blocked, unblock] = useRetryBlock(state.retryAfterSeconds);

  const canAdvance = [true, !!primaryGoal, !!targetLanguage, !!nativeLanguage, !!selfReportedCefr][step];

  // M3 Slice 9 — mounts exactly once, on first render of the pre-account
  // wizard (same "mount = start" proxy the old first-win flow used for
  // signup_completed, since there's no server-side profile row yet at
  // Welcome to attach a real event to).
  useEffect(() => {
    track("onboarding_started", {});
  }, []);

  if (step === 0) {
    return <SplashScreen onStart={() => setStep(1)} />;
  }

  const back = () => setStep((s) => s - 1);

  if (step === 5) {
    return (
      <StepShell step={5} total={TOTAL_STEPS} onBack={back}>
        <form action={formAction} className="flex flex-1 flex-col md:flex-none">
          <AuthBody>
            <LexSay mood="joy" heading="Создай аккаунт">
              Слова и прогресс сохранятся на всех твоих устройствах.
            </LexSay>
            <input type="hidden" name="primaryGoal" value={primaryGoal} />
            <input type="hidden" name="targetLanguage" value={targetLanguage} />
            <input type="hidden" name="nativeLanguage" value={nativeLanguage} />
            <input type="hidden" name="selfReportedCefr" value={selfReportedCefr} />

            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              requiredMark={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              icon={<Mail />}
            />
            <PasswordField name="password" autoComplete="new-password" required meter />

            {blocked && state.retryAfterSeconds ? (
              <RateLimitNotice
                key={state.retryAfterSeconds}
                message={state.error ?? "Слишком много попыток регистрации."}
                retryAfterSeconds={state.retryAfterSeconds}
                onExpire={unblock}
              />
            ) : (
              state.error &&
              !state.retryAfterSeconds && (
                <Alert tone="error" live="assertive">
                  {state.error}
                </Alert>
              )
            )}

            <p className="text-center text-xs text-[var(--text-secondary)]">
              Создавая аккаунт, ты соглашаешься с{" "}
              <Link href="/terms" className="underline underline-offset-2">
                условиями использования
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                политикой конфиденциальности
              </Link>
              .
            </p>
          </AuthBody>
          <AuthDock>
            <Button type="submit" block loading={pending} disabled={blocked}>
              Создать аккаунт и начать
            </Button>
          </AuthDock>
        </form>
      </StepShell>
    );
  }

  return (
    <StepShell step={step} total={TOTAL_STEPS} onBack={back}>
      <AuthBody>
        {step === 1 && (
          <>
            <LexSay mood="happy" heading="Для чего тебе английский?">
              Подберу тексты и слова под цель.
            </LexSay>
            <ChoiceGroup
              legend="Для чего тебе английский?"
              name="goal"
              value={primaryGoal}
              onValueChange={(goal) => {
                setPrimaryGoal(goal);
                track("onboarding_goal_selected", { goal });
              }}
              options={GOALS.map((g) => {
                const visual = GOAL_VISUALS[g.id];
                const Icon = visual.icon;
                return { value: g.id, label: g.label, description: visual.description, icon: <Icon />, tone: visual.tone };
              })}
            />
          </>
        )}

        {step === 2 && (
          <>
            <LexSay mood="wink" heading="Какой язык учишь?">
              Пока готов английский — остальные скоро.
            </LexSay>
            <LanguagePicker
              name="target-language"
              legend="Какой язык учишь?"
              value={targetLanguage}
              restrictToReady
              onChange={(code) => {
                setTargetLanguage(code);
                // Следующий шаг (родной язык) уже исключает targetLanguage из
                // списка, но если пользователь вернётся сюда и сменит целевой язык
                // на тот, что уже выбран как родной, коллизия обнаруживалась бы
                // только на финальном сабмите. Сбрасываем родной язык сразу.
                if (code === nativeLanguage) setNativeLanguage("");
              }}
            />
          </>
        )}

        {step === 3 && (
          <>
            <LexSay mood="happy" heading="Какой у тебя родной язык?">
              На него будем переводить слова.
            </LexSay>
            <LanguagePicker
              name="native-language"
              legend="Какой у тебя родной язык?"
              value={nativeLanguage}
              exclude={targetLanguage}
              onChange={setNativeLanguage}
            />
          </>
        )}

        {step === 4 && (
          <>
            <LexSay mood="think" heading="Какой у тебя уровень английского?">
              Это не экзамен — просто ориентир. Дальше уточним коротким тестом.
            </LexSay>
            <ChoiceGroup
              legend="Какой у тебя уровень английского?"
              name="level"
              value={selfReportedCefr}
              onValueChange={(level) => {
                setSelfReportedCefr(level);
                track("onboarding_level_selected", { self_reported_cefr: level });
              }}
              options={SELF_REPORT_LEVELS.map((l) => ({
                value: l.value,
                label: l.label,
                description: LEVEL_HINTS[l.value],
              }))}
            />
          </>
        )}
      </AuthBody>
      <AuthDock>
        <Button block disabled={!canAdvance} onClick={() => setStep(step + 1)}>
          Далее
        </Button>
      </AuthDock>
    </StepShell>
  );
}
