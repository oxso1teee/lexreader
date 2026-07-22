"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";
import { LEVELS, DAILY_GOALS } from "@/lib/onboarding-options";
import {
  savePushSubscription,
  deletePushSubscription,
  sendTestPush,
  updateProfile,
  type UpdateProfileState,
} from "./actions";
import { signOut } from "../actions";

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
  targetLanguage,
  nativeLanguage,
  level,
  dailyWordGoal,
  plan,
  initialPushEnabled,
}: {
  targetLanguage: string;
  nativeLanguage: string;
  level: string | null;
  dailyWordGoal: number;
  plan: string;
  initialPushEnabled: boolean;
}) {
  const [pushEnabled, setPushEnabled] = useState(initialPushEnabled);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const pushSupported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

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
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
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
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Профиль</h2>
        <ProfileForm
          targetLanguage={targetLanguage}
          nativeLanguage={nativeLanguage}
          level={level}
          dailyWordGoal={dailyWordGoal}
        />
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Подписка</h2>
        <p className="mb-3 text-sm text-black/60 dark:text-white/60">
          Текущий тариф: {plan === "free" ? "бесплатный" : plan === "premium_monthly" ? "Premium (месяц)" : "Premium (год)"}
        </p>
        <Link
          href="/paywall"
          className="text-sm text-black underline dark:text-white"
        >
          Управление подпиской
        </Link>
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Уведомления</h2>
        {!pushSupported ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            Этот браузер не поддерживает push-уведомления.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-black/60 dark:text-white/60">
              Напоминание о повторении слов, когда накопится очередь.
            </p>
            {pushError && <p className="text-sm text-red-600 dark:text-red-400">{pushError}</p>}
            {!pushEnabled ? (
              <button
                type="button"
                disabled={pushBusy}
                onClick={enablePush}
                className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {pushBusy ? "…" : "Включить напоминания"}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={pushBusy}
                  onClick={disablePush}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-white/15"
                >
                  Отключить
                </button>
                <button
                  type="button"
                  onClick={handleTestPush}
                  className="text-sm text-black/60 underline dark:text-white/60"
                >
                  Тестовое уведомление
                </button>
              </div>
            )}
            {testResult && <p className="text-sm text-black/60 dark:text-white/60">{testResult}</p>}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="mb-2 font-medium">Данные</h2>
        <a
          href="/api/export/vocabulary"
          download
          className="text-sm text-black underline dark:text-white"
        >
          Экспортировать словарь в CSV
        </a>
      </section>

      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-red-600 underline dark:text-red-400"
        >
          Выйти из аккаунта
        </button>
      </form>
    </div>
  );
}

function ProfileForm({
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

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="target_language" value={target} />
      <input type="hidden" name="native_language" value={native} />
      <input type="hidden" name="level" value={lvl} />
      <input type="hidden" name="daily_word_goal" value={goal} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-black/50 dark:text-white/50">Изучаю</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {LANGUAGES.filter((l) => l.code !== native).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-black/50 dark:text-white/50">Родной язык</span>
        <select
          value={native}
          onChange={(e) => setNative(e.target.value)}
          className="rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        >
          {LANGUAGES.filter((l) => l.code !== target).map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      {languageChanged && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Тексты и слова для текущего языка останутся в базе, но пропадут из библиотеки, пока не
          переключишься обратно.
        </p>
      )}

      <div>
        <p className="mb-1 text-sm text-black/50 dark:text-white/50">Уровень</p>
        <div className="grid grid-cols-3 gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLvl(l.value)}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                lvl === l.value
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm text-black/50 dark:text-white/50">Цель в день</p>
        <div className="grid grid-cols-4 gap-1.5">
          {DAILY_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGoal(g)}
              className={`rounded-lg border py-2 text-sm font-medium transition-colors ${
                goal === g
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/10 dark:border-white/15"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.saved && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">Сохранено ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "…" : "Сохранить"}
      </button>
    </form>
  );
}
