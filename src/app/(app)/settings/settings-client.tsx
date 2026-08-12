"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { LANGUAGES, languageName } from "@/lib/languages";
import { LEVELS, DAILY_GOALS } from "@/lib/onboarding-options";
import { planLabel, subscriptionPeriodInfo, showPastDueWarning, type Plan } from "@/lib/subscription-display";
import { track } from "@/lib/posthog-client";
import ProfileCard from "@/components/product/settings/profile-card";
import SectionHeader from "@/components/product/section-header";
import {
  savePushSubscription,
  deleteAllPushSubscriptions,
  sendTestPush,
  updateProfile,
  type UpdateProfileState,
} from "./actions";
import { signOut } from "../actions";
import { deleteAccount, type DeleteAccountState } from "./delete-account-actions";
import HapticsToggle from "./haptics-toggle";
import FeedbackForm from "./feedback-form";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export default function SettingsClient({
  email,
  createdAt,
  targetLanguage,
  nativeLanguage,
  level,
  dailyWordGoal,
  plan,
  subscriptionStatus,
  subscriptionPeriodEnd,
  hasStripeCustomer,
  initialPushEnabled,
}: {
  email: string;
  createdAt: string;
  targetLanguage: string;
  nativeLanguage: string;
  level: string | null;
  dailyWordGoal: number;
  plan: Plan;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  initialPushEnabled: boolean;
}) {
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const pushSupported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  // Не PII (docs/ui/analytics-events.md конвенция этого проекта): только
  // enum-план, без email/user id/сумм — видна при каждом визите Settings,
  // т.к. секция подписки всегда отрендерена, не за экспандером.
  useEffect(() => {
    track("subscription_section_viewed", { plan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Разрешение на уведомления не выдано.");
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error("Push не настроен на сервере.");

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await savePushSubscription(subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      setPushEnabled(true);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Не удалось включить уведомления.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      // Единственный тумблер в UI означает "отключить везде" — удаляем все
      // подписки владельца на сервере, а не только текущего устройства.
      await deleteAllPushSubscriptions();
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Не удалось отключить уведомления.");
    } finally {
      setPushBusy(false);
    }
  }

  async function handleTestPush() {
    setTestResult(null);
    const result = await sendTestPush();
    setTestResult(result.ok ? "Отправлено — проверь уведомления." : (result.error ?? "Ошибка"));
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileCard
        email={email}
        targetLanguageName={languageName(targetLanguage)}
        nativeLanguageName={languageName(nativeLanguage)}
        dailyWordGoal={dailyWordGoal}
        createdAt={createdAt}
        planLabel={planLabel(plan)}
      />

      <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
        <SectionHeader title="Учебные настройки" />
        <div className="mt-3">
          <LearningPreferencesForm
            targetLanguage={targetLanguage}
            nativeLanguage={nativeLanguage}
            level={level}
            dailyWordGoal={dailyWordGoal}
          />
        </div>

        <hr className="my-4 border-[var(--border)]" />

        {!pushSupported ? (
          <p className="text-body-sm text-[var(--text-secondary)]">
            Этот браузер не поддерживает push-уведомления.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-body-sm font-semibold">Напоминание о повторении</p>
                <p className="text-caption text-[var(--text-secondary)]">Когда накопится очередь карточек</p>
              </div>
              {!pushEnabled ? (
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={enablePush}
                  className="focus-ring flex min-h-11 items-center rounded-full bg-black px-4 text-body-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                >
                  {pushBusy ? "…" : "Включить"}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={disablePush}
                  className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium disabled:opacity-50"
                >
                  Отключить
                </button>
              )}
            </div>
            {pushError && (
              <p role="alert" className="text-body-sm text-[var(--color-danger-text)]">
                {pushError}
              </p>
            )}
            {pushEnabled && (
              <button
                type="button"
                onClick={handleTestPush}
                className="focus-ring self-start text-body-sm text-[var(--color-caramel-text)] underline"
              >
                Тестовое уведомление
              </button>
            )}
            {testResult && <p className="text-body-sm text-[var(--text-secondary)]">{testResult}</p>}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
        <SectionHeader title="Подписка" />
        <p className="text-body-sm mt-2">
          Текущий тариф: <strong>{planLabel(plan)}</strong>
        </p>
        {showPastDueWarning(plan, subscriptionStatus) && (
          <p className="text-body-sm mt-1 text-[var(--color-warning)]">
            Последнее списание не прошло — обнови способ оплаты, доступ сохранится ещё некоторое время.
          </p>
        )}
        {(() => {
          const period = subscriptionPeriodInfo(plan, subscriptionStatus, subscriptionPeriodEnd);
          return (
            period && (
              <p className="text-body-sm mt-1 text-[var(--text-secondary)]">
                {period.label}: {period.formattedDate}
              </p>
            )
          );
        })()}
        {plan === "free" && (
          <p className="text-body-sm mt-1 text-[var(--text-secondary)]">Управление подпиской и смена плана — на странице тарифов.</p>
        )}
        {hasStripeCustomer && plan !== "free" && (
          <p className="text-caption mt-1 text-[var(--text-secondary)]">Оплата через Stripe.</p>
        )}
        <Link href="/pricing" className="focus-ring mt-2 inline-block text-body-sm font-semibold text-[var(--color-caramel-text)]">
          {plan === "free" ? "Посмотреть тарифы" : "Управление подпиской"} →
        </Link>
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
        <SectionHeader title="Мой английский" />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-body-sm">Language Twin: профиль, паттерны, приватность</span>
          <Link
            href="/language-twin/settings"
            className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
          >
            Открыть
          </Link>
        </div>
        {/* M3 Slice 9 §31/§36 — compact link only, no duplicated retake UI
            here; the full self-report/Placement/behavioral breakdown and
            the actual retake flow live on /language-twin ("Как это
            посчитано?"). */}
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-2">
          <span className="text-body-sm">Диагностика английского</span>
          <Link
            href="/language-twin"
            className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
          >
            Открыть
          </Link>
        </div>
      </section>

      <HapticsToggle />

      <FeedbackForm />

      <section className="rounded-2xl bg-[var(--surface)] p-4 shadow-sm">
        <SectionHeader title="Аккаунт и безопасность" />
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm">Пароль</span>
            <Link
              href="/reset-password"
              onClick={() => track("password_reset_opened_from_settings")}
              className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
            >
              Сменить пароль
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm">Экспорт словаря (CSV)</span>
            <a
              href="/api/export/vocabulary"
              download
              className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
            >
              Скачать
            </a>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-body-sm">Все данные (JSON)</span>
            <a
              href="/api/export/data"
              download
              className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
            >
              Скачать
            </a>
          </div>

          <hr className="border-[var(--border)]" />

          <form action={signOut}>
            <button
              type="submit"
              className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
            >
              Выйти из аккаунта
            </button>
          </form>

          <DeleteAccountSection />
        </div>
      </section>

      <div className="flex gap-4 text-caption text-[var(--text-secondary)]">
        <Link href="/changelog" className="focus-ring underline">
          Что нового
        </Link>
        <Link href="/terms" className="focus-ring underline">
          Условия использования
        </Link>
        <Link href="/privacy" className="focus-ring underline">
          Конфиденциальность
        </Link>
      </div>
    </div>
  );
}

function LearningPreferencesForm({
  targetLanguage,
  nativeLanguage,
  level,
  dailyWordGoal,
}: {
  targetLanguage: string;
  nativeLanguage: string;
  level: string | null;
  dailyWordGoal: number;
}) {
  const [state, formAction, pending] = useActionState<UpdateProfileState, FormData>(
    updateProfile,
    {},
  );
  const [target, setTarget] = useState(targetLanguage);
  const [native, setNative] = useState(nativeLanguage);
  const [lvl, setLvl] = useState(level ?? "beginner");
  const [goal, setGoal] = useState(dailyWordGoal);

  const languageChanged = target !== targetLanguage;

  useEffect(() => {
    if (state.saved) track("learning_preferences_updated");
  }, [state.saved]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="target_language" value={target} />
      <input type="hidden" name="native_language" value={native} />
      <input type="hidden" name="level" value={lvl} />
      <input type="hidden" name="daily_word_goal" value={goal} />

      <label className="flex flex-col gap-1 text-body-sm">
        <span className="text-[var(--text-secondary)]">Изучаю</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="focus-ring rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-body-sm"
        >
          {LANGUAGES.filter((l) => l.code !== native).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-body-sm">
        <span className="text-[var(--text-secondary)]">Родной язык</span>
        <select
          value={native}
          onChange={(e) => setNative(e.target.value)}
          className="focus-ring rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-2 text-body-sm"
        >
          {LANGUAGES.filter((l) => l.code !== target).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      {languageChanged && (
        <p className="text-caption text-[var(--color-warning)]">
          Тексты и слова для текущего языка останутся в базе, но пропадут из библиотеки, пока не
          переключишься обратно.
        </p>
      )}

      <div>
        <p id="level-label" className="text-body-sm mb-1 text-[var(--text-secondary)]">
          Уровень
        </p>
        <div role="group" aria-labelledby="level-label" className="grid grid-cols-3 gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={lvl === l.value}
              onClick={() => setLvl(l.value)}
              className={`focus-ring flex min-h-11 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors ${
                lvl === l.value
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-[var(--border-strong)]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p id="goal-label" className="text-body-sm mb-1 text-[var(--text-secondary)]">
          Цель в день
        </p>
        <div role="group" aria-labelledby="goal-label" className="grid grid-cols-4 gap-1.5">
          {DAILY_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={goal === g}
              onClick={() => setGoal(g)}
              className={`focus-ring flex min-h-11 items-center justify-center rounded-lg border text-body-sm font-medium transition-colors ${
                goal === g
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-[var(--border-strong)]"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div aria-live="polite">
        {state.error && (
          <p role="alert" className="text-body-sm text-[var(--color-danger-text)]">
            {state.error}
          </p>
        )}
        {state.saved && <p className="text-body-sm text-[var(--color-success)]">Сохранено ✓</p>}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="focus-ring self-start flex min-h-11 items-center rounded-full bg-black px-5 text-body-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "…" : "Сохранить"}
      </button>
    </form>
  );
}

function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {},
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring flex min-h-11 items-center rounded-full border border-[var(--color-danger)] px-4 text-body-sm font-medium text-[var(--color-danger-text)]"
      >
        Удалить аккаунт
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-danger)] p-4">
      <h3 className="text-body-sm mb-2 font-semibold text-[var(--color-danger-text)]">Удалить аккаунт</h3>
      <p className="text-body-sm mb-3 text-[var(--text-secondary)]">
        Это необратимо удалит твой аккаунт и все данные: тексты, слова, карточки, прогресс. Если
        есть активная подписка, она будет отменена. Чтобы подтвердить, введи «УДАЛИТЬ».
      </p>
      <form action={formAction} className="flex flex-col gap-2">
        <label htmlFor="delete-confirmation" className="sr-only">
          Введи УДАЛИТЬ для подтверждения
        </label>
        <input
          id="delete-confirmation"
          type="text"
          name="confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="УДАЛИТЬ"
          className="focus-ring w-full rounded-lg border border-[var(--color-danger)] px-3 py-2 text-body-sm"
        />
        {state.error && (
          <p role="alert" className="text-body-sm text-[var(--color-danger-text)]">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="focus-ring flex min-h-11 items-center justify-center rounded-full border border-[var(--border-strong)] px-4 text-body-sm font-medium"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={pending || confirmation !== "УДАЛИТЬ"}
            className="focus-ring flex min-h-11 flex-1 items-center justify-center rounded-full bg-[var(--color-danger)] text-body-sm font-medium text-white disabled:opacity-40"
          >
            {pending ? "…" : "Удалить аккаунт навсегда"}
          </button>
        </div>
      </form>
    </div>
  );
}
